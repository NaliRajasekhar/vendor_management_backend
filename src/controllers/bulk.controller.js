import fs from 'fs'
import path from 'path'
import { parse } from 'fast-csv'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { query, getClient } from '../config/db.js'

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

// Expected CSV headers (case-insensitive):
// vendor, client, implementation, name, department, email, phone, city, state
export async function uploadVendorClientsCsv(req, res, next) {
  if (!req.file) return res.status(400).json({ message: 'CSV file is required' })
  const filePath = req.file.path
  const BATCH_SIZE = 1000
  let inserted = 0
  let failed = 0
  const vendorCache = new Map() // vendor_name_norm -> vendor_id

  const cleanup = () => { fs.existsSync(filePath) && fs.unlinkSync(filePath) }

  const client = await getClient()
  try {
    await client.query('BEGIN')

    const stream = fs.createReadStream(filePath)
      .pipe(parse({ headers: true, ignoreEmpty: true, trim: true }))

    let batch = []

    const flush = async () => {
      if (batch.length === 0) return
      // Upsert vendors first
      const vendorNames = [...new Set(batch.map(r => (r.vendor || '').trim()).filter(Boolean))]
      for (const vName of vendorNames) {
        const key = vName.toLowerCase()
        if (vendorCache.has(key)) continue
        // Try find existing
        const found = await client.query(`SELECT vendor_id FROM public.vendors WHERE vendor_name_norm = lower($1) LIMIT 1`, [vName])
        if (found.rows[0]?.vendor_id) {
          vendorCache.set(key, found.rows[0].vendor_id)
          continue
        }
        const ins = await client.query(
          `INSERT INTO public.vendors (vendor_name) VALUES ($1) RETURNING vendor_id`,
          [vName]
        )
        vendorCache.set(key, ins.rows[0].vendor_id)
      }

      // Resolve vendor_ids for batch
      const toInsert = []
      for (const r of batch) {
        try {
          const vendorName = (r.vendor || '').trim()
          const vendorId = vendorName ? vendorCache.get(vendorName.toLowerCase()) : null
          if (!vendorId) { failed++; continue }
          toInsert.push([
            vendorId,
            r.client || null,
            r.implementation || null,
            r.name || null,
            r.department || null,
            r.email || null,
            r.phone || null,
            r.city || null,
            r.state || null
          ])
        } catch {
          failed++
        }
      }
      // Batch insert vendor_clients
      if (toInsert.length) {
        // Build multi-row VALUES
        const values = []
        const params = []
        let i = 1
        for (const row of toInsert) {
          values.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`)
          params.push(...row)
        }
        await client.query(
          `INSERT INTO public.vendor_clients (
             vendor_id, client_name, implementation_partner_name, contact_person_name,
             department, email, phone, client_city, client_state
           ) VALUES ${values.join(',')}`,
          params
        )
        inserted += toInsert.length
      }
      batch = []
    }

    await new Promise((resolve, reject) => {
      stream.on('error', reject)
      stream.on('data', (row) => {
        batch.push({
          vendor: row.vendor || row.Vendor || row.VENDOR || '',
          client: row.client || row.Client || row.CLIENT || '',
          implementation: row.implementation || row.Implementation || row.IMPLEMENTATION || '',
          name: row.name || row.Name || row.NAME || '',
          department: row.department || row.Department || row.DEPARTMENT || '',
          email: row.email || row.Email || row.EMAIL || '',
          phone: row.phone || row.Phone || row.PHONE || '',
          city: row.city || row.City || row.CITY || '',
          state: row.state || row.State || row.STATE || ''
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
    cleanup()
    res.json({ inserted, failed })
  } catch (err) {
    try { await client.query('ROLLBACK') } catch {}
    cleanup()
    next(err)
  } finally {
    client.release()
  }
}
