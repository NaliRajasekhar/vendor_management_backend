import fs from 'fs'
import path from 'path'
import { parse } from 'fast-csv'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { query, getClient } from '../config/db.js'
import { log } from 'console'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadDir = path.join(__dirname, '../../.tmp')
fs.mkdirSync(uploadDir, { recursive: true })

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 1024 * 1024 * 512 } // 512MB
})

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usPhoneRegex = /^(?:\+1\s?|1\s?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/

// Expected CSV headers (case-insensitive):
// vendor, client, implementation, name, department, email, phone, city, state
export async function uploadVendorClientsCsv(req, res, next) {
  if (!req.file) return res.status(400).json({ message: 'CSV file is required' })
  const filePath = req.file.path
  const BATCH_SIZE = 1000
  let inserted = 0
  let failed = 0
  let duplicates = 0
  const rowErrors = [] // { row, type: 'error', reason, data }
  const rowDuplicates = [] // { row, type: 'duplicate', reason, data }
  const vendorCache = new Map() // vendor_name_norm -> vendor_id

  const cleanup = () => { fs.existsSync(filePath) && fs.unlinkSync(filePath) }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    const stream = fs.createReadStream(filePath)
      .pipe(parse({ headers: true, ignoreEmpty: true, trim: true }))

    let batch = [] // items: { row, vendor, client, ... }
    let rowCounter = 0
    // const normLower = (v) => (v == null || String(v).trim() === '' ? '' : String(v).trim().toLowerCase())
    const normLower = (v) => (v == null || String(v).trim() === '' ? '' : String(v).trim().toLowerCase())
    // Convert CSV MSA string to boolean
    const parseMsa = (val) => {
      
      if (val === undefined || val === null) return null
      const s = String(val).trim().toLowerCase()
      if (s === '') return null
      // truthy forms (case-insensitive)
      if (['true', 't', 'yes', 'y', '1', 'active', 'on', 'primary'].includes(s)) return true
      // falsey forms (case-insensitive)
      if (['false', 'f', 'no', 'n', '0', 'inactive', 'off'].includes(s)) return false
      // unrecognized → null (don’t insert bad data)
      return null
    }

    


    const flush = async () => {
      if (batch.length === 0) return
      // Upsert vendors first
      const vendorNames = [...new Set(batch.map(r => (r.vendor || '').trim()).filter(Boolean))]
      for (const vName of vendorNames) {
        const key = vName.toLowerCase()
        if (vendorCache.has(key)) continue
        // Try find existing
        const found = await client.query(
          `SELECT vendor_id FROM public.vendors WHERE vendor_name_norm = lower($1) LIMIT 1`,
          [vName]
        )
        if (found.rows[0]?.vendor_id) {
          vendorCache.set(key, found.rows[0].vendor_id)
          continue
        }
        // Try insert; if unique violation occurs, re-select and proceed
        try {
          const ins = await client.query(
            `INSERT INTO public.vendors (vendor_name) VALUES ($1) RETURNING vendor_id`,
            [vName]
          )
          vendorCache.set(key, ins.rows[0].vendor_id)
        } catch (e) {
          if (String(e?.code) === '23505') {
            const again = await client.query(
              `SELECT vendor_id FROM public.vendors WHERE vendor_name_norm = lower($1) LIMIT 1`,
              [vName]
            )
            if (again.rows[0]?.vendor_id) {
              vendorCache.set(key, again.rows[0].vendor_id)
            } else {
              throw e
            }
          } else {
            throw e
          }
        }
      }

      // Resolve vendor_ids for batch and validate row data
      const toInsert = [] // objects with shape used to build SQL and map back
      for (const r of batch) {
        try {
          const vendorName = (r.vendor || '').trim()
          const vendorId = vendorName ? vendorCache.get(vendorName.toLowerCase()) : null
          if (!vendorId) {
            failed++
            rowErrors.push({ row: r.row, type: 'error', reason: 'Unknown or missing vendor', data: r })
            continue
          }

          const email = (r.email || '').trim()
          const phone = (r.phone || '').trim()

          if (email && !emailRegex.test(email)) {
            failed++
            rowErrors.push({ row: r.row, type: 'error', reason: 'Invalid email format', data: r })
            continue
          }
          if (phone && !usPhoneRegex.test(phone)) {
            failed++
            rowErrors.push({ row: r.row, type: 'error', reason: 'Invalid US phone format', data: r })
            continue
          }

          toInsert.push({
            row: r.row,
            vendor_id: vendorId,
            client_name: r.client || null,
            implementation_partner_name: r.implementation || null,
            contact_person_name: r.name || null,
            designation: r.designation || null,
            department: r.department || null,
            email: email || null,
            phone: phone || null,
            client_city: r.city || null,
            client_state: r.state || null,
            msa: parseMsa(r.msa)
          })
        } catch (e) {
          failed++
          rowErrors.push({ row: r.row, type: 'error', reason: 'Unexpected parsing error', data: r })
        }
      }

      // 1) Remove duplicates within the file by (vendor_id, client_name, implementation_partner_name, email)
      const seen = new Set()
      const candidates = []
      for (const item of toInsert) {
        const key = [
          String(item.vendor_id || ''),
          normLower(item.client_name),
          normLower(item.implementation_partner_name),
          normLower(item.email)
        ].join('|')
        if (seen.has(key)) {
          duplicates += 1
          rowDuplicates.push({ row: item.row, type: 'duplicate', reason: 'Duplicate in file (vendor+client+implementation+email)', data: item })
        } else {
          seen.add(key)
          candidates.push(item)
        }
      }

      // 1b) Exclude rows where email already exists in DB (duplicate email)
      let candidatesAfterEmail = candidates
      try {
        const emails = [...new Set(candidates.map(c => normLower(c.email)).filter(e => e !== ''))]
        if (emails.length) {
          const ph = emails.map((_, idx) => `$${idx + 1}`).join(',')
          const existingEmails = await client.query(
            `SELECT DISTINCT lower(email) AS email FROM public.vendor_clients WHERE lower(email) IN (${ph})`,
            emails
          )
          const existEmails = new Set(existingEmails.rows.map(r => r.email || ''))
          const filtered = []
          for (const c of candidates) {
            const em = normLower(c.email)
            if (em && existEmails.has(em)) {
              duplicates += 1
              rowDuplicates.push({ row: c.row, type: 'duplicate', reason: 'Duplicate email', data: c })
            } else {
              filtered.push(c)
            }
          }
          candidatesAfterEmail = filtered
        }
      } catch {}

      // 2) Exclude rows already present in DB by same combination
      let toInsertFinal = []
      if (candidatesAfterEmail.length) {
        const tupleSql = []
        const tupleParams = []
        let j = 1
        for (const c of candidatesAfterEmail) {
          // Cast placeholders to ensure correct types and avoid bigint=text comparison errors
          tupleSql.push(`($${j++}::bigint,$${j++}::text,$${j++}::text,$${j++}::text)`)
          tupleParams.push(
            c.vendor_id,
            normLower(c.client_name),
            normLower(c.implementation_partner_name),
            normLower(c.email)
          )
        }
        const existing = await client.query(
          `SELECT vendor_id,
                  lower(client_name) AS client_name,
                  lower(implementation_partner_name) AS implementation_partner_name,
                  COALESCE(lower(email), '') AS email
             FROM public.vendor_clients
            WHERE (vendor_id, lower(client_name), lower(implementation_partner_name), COALESCE(lower(email), ''))
                  IN (VALUES ${tupleSql.join(',')})`,
          tupleParams
        )
        const existKeys = new Set(existing.rows.map(r => [
          String(r.vendor_id || ''),
          r.client_name || '',
          r.implementation_partner_name || '',
          r.email || ''
        ].join('|')))
        for (const c of candidatesAfterEmail) {
          const key = [
            String(c.vendor_id || ''),
            normLower(c.client_name),
            normLower(c.implementation_partner_name),
            normLower(c.email)
          ].join('|')
          if (existKeys.has(key)) {
            duplicates += 1
            rowDuplicates.push({ row: c.row, type: 'duplicate', reason: 'Duplicate (existing vendor+client+implementation+email)', data: c })
          } else {
            toInsertFinal.push(c)
          }
        }
      }

      // Batch insert vendor_clients
      if (toInsertFinal.length) {
        // Build multi-row VALUES
        const values = []
        const params = []
        let i = 1
        for (const item of toInsertFinal) {
          // 11 placeholders to match 11 columns including designation and msa
          values.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`)
          params.push(
            item.vendor_id,
            item.client_name,
            item.implementation_partner_name,
            item.contact_person_name,
            item.designation,
            item.department,
            item.email,
            item.phone,
            item.client_city,
            item.client_state,
            item.msa
          )
        }
        const result = await client.query(
          `INSERT INTO public.vendor_clients (
             vendor_id, client_name, implementation_partner_name, contact_person_name,
             designation, department, email, phone, client_city, client_state, msa
           ) VALUES ${values.join(',')}
           ON CONFLICT DO NOTHING
           RETURNING vendor_id, client_name, implementation_partner_name, contact_person_name,
                     designation, department, email, phone, client_city, client_state, msa`,
          params
        )
        const ok = Number(result?.rowCount || 0)
        inserted += ok
        const skipped = toInsertFinal.length - ok
        duplicates += skipped

        // Map inserted back to keys to determine which ones were skipped (duplicates)
        const keyOf = (x) => [
          String(x.vendor_id || ''),
          String(x.client_name || ''),
          String(x.implementation_partner_name || ''),
          String(x.contact_person_name || ''),
          String(x.designation || ''),
          String(x.department || ''),
          String(x.email || ''),
          String(x.phone || ''),
          String(x.client_city || ''),
          String(x.client_state || ''),
          String(x.msa ?? '')
        ].join('|')
        const insertedKeys = new Set(result.rows.map(keyOf))
        for (const item of toInsertFinal) {
          if (!insertedKeys.has(keyOf(item))) {
            rowDuplicates.push({ row: item.row, type: 'duplicate', reason: 'Duplicate row (existing record)', data: item })
          }
        }
      }
      batch = []
    }

    await new Promise((resolve, reject) => {
      stream.on('error', reject)
      stream.on('data', (row) => {
        rowCounter += 1
        batch.push({
          row: rowCounter,
          vendor: row.vendor || row.Vendor || row.VENDOR || '',
          client: row.client || row.Client || row.CLIENT || '',
          implementation: row.implementation || row.Implementation || row.IMPLEMENTATION || '',
          name: row.name || row.Name || row.NAME || '',
          designation: row.designation || row.Designation || row.DESIGNATION || '',
          department: row.department || row.Department || row.DEPARTMENT || '',
          email: row.email || row.Email || row.EMAIL || '',
          phone: row.phone || row.Phone || row.PHONE || '',
          city: row.city || row.City || row.CITY || '',
          state: row.state || row.State || row.STATE || '',
          msa: row.msa || row.Msa || row.MSA
        })
        if (batch.length >= BATCH_SIZE) {
          stream.pause()
          flush().then(() => stream.resume()).catch(reject)
        }
      })
      stream.on('end', () => {
        flush().then(resolve).catch(reject)
      })
    })

    await client.query('COMMIT')

    // If there are issues, write an error report CSV to uploads and share the URL
    let errorReportUrl = null
    if (rowErrors.length || rowDuplicates.length) {
      try {
        const uploadsDir = path.resolve(process.cwd(), 'backend', 'uploads')
        const ts = Date.now()
        const fileName = `csv-upload-errors-${ts}.csv`
        const absPath = path.join(uploadsDir, fileName)
        const header = 'type,row,vendor,client,implementation,name,designation,department,email,phone,city,state,msa,reason' + '\n'
        const lines = []
        const toCsvVal = (v) => {
          if (v == null) return ''
          const s = String(v)
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"'
          }
          return s
        }
        const pushLine = (t, r) => {
          const d = r.data || {}
          lines.push([
            t,
            r.row,
            d.vendor || d.vendor_name || '',
            d.client || d.client_name || '',
            d.implementation || d.implementation_partner_name || '',
            d.name || d.contact_person_name || '',
            d.designation || '',
            d.department || '',
            d.email || '',
            d.phone || '',
            d.city || d.client_city || '',
            d.state || d.client_state || '',
            (d.msa ?? ''),
            r.reason || ''
          ].map(toCsvVal).join(','))
        }
        for (const e of rowErrors) pushLine('error', e)
        for (const d of rowDuplicates) pushLine('duplicate', d)
        fs.writeFileSync(absPath, header + lines.join('\n'), 'utf8')
        errorReportUrl = `/uploads/${fileName}`
      } catch { }
    }

    cleanup()
    res.json({ inserted, failed, duplicates, errors: rowErrors.length, duplicatesDetailed: rowDuplicates.length, errorReportUrl })
  } catch (err) {
    try { await client.query('ROLLBACK') } catch { }
    cleanup()
    next(err)
  } finally {
    client.release()
  }
}
