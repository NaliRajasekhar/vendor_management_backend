import { validateVendor } from '../utils/validate.js'
import { listVendors, getVendor, createVendor, updateVendor, deleteVendor } from '../models/vendors.model.js'
import { query } from '../config/db.js'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'


export async function index(_req, res, next) {
  try {
    const items = await listVendors()
    res.json(items)
  } catch (err) { next(err) }
}

export async function show(req, res, next) {
  try {
    const item = await getVendor(req.params.id)
    if (!item) return res.status(404).json({ message: 'Vendor not found' })
    res.json(item)
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const errors = validateVendor(req.body || {})
    if (Object.keys(errors).length) {
      const e = new Error('Validation failed')
      e.statusCode = 400
      e.details = errors
      throw e
    }
    const item = await createVendor(null, req.body)
    res.status(201).json(item)
  } catch (err) { next(err) }
}

export async function update(req, res, next) {
  try {
    const item = await updateVendor(req.params.id, req.body || {})
    if (!item) return res.status(404).json({ message: 'Vendor not found' })
    res.json(item)
  } catch (err) { next(err) }
}

export async function destroy(req, res, next) {
  try {
    const ok = await deleteVendor(req.params.id)
    if (!ok) return res.status(404).json({ message: 'Vendor not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}

// Check email uniqueness across vendor client emails
export async function checkEmail(req, res, next) {
  try {
    const { email = '', excludeId } = req.query || {}
    const emailStr = String(email).trim()
    const emailRegex = /\S+@\S+\.[A-Za-z]{2,}/
    if (!emailStr || !emailRegex.test(emailStr)) {
      return res.json({ unique: false })
    }
    const exclude = excludeId ? Number(excludeId) : null
    const { rows } = await query(
      `SELECT COUNT(*)::int AS cnt
         FROM public.vendor_clients
        WHERE lower(email) = lower($1)
          AND ($2::bigint IS NULL OR id <> $2)`,
      [emailStr, exclude]
    )
    const cnt = Number(rows?.[0]?.cnt || 0)
    return res.json({ unique: cnt === 0 })
  } catch (err) { next(err) }
}

// Create with file upload (multipart/form-data)
export async function createWithFile(req, res, next) {
  try {
    const payload = req.body || {}
    // Normalize booleans
    if (typeof payload.isPrimary === 'string') payload.isPrimary = payload.isPrimary === 'true' || payload.isPrimary === '1'

    const errors = validateVendor(payload)
    if (Object.keys(errors).length) {
      const e = new Error('Validation failed')
      e.statusCode = 400
      e.details = errors
      throw e
    }

    const id = randomUUID()
    const file = req.file
    let msvFileUrl = null
    if (file) {
      // Expose via /uploads route set in app.js
      msvFileUrl = `/uploads/${file.filename}`
    }
    const item = await createVendor(id, { ...payload, msvFileUrl })
    // Also persist on public.vendors for this vendor name if provided
    if (payload.vendor && msvFileUrl) {
      try {
        await query(
          `UPDATE public.vendors SET msv_file_url = $2, updated_at = NOW()
           WHERE vendor_name_norm = lower($1)`,
          [payload.vendor, msvFileUrl]
        )
      } catch {}
    }
    res.status(201).json(item)
  } catch (err) { next(err) }
}

// Update vendor-client with optional MSV file upload
export async function updateWithFile(req, res, next) {
  try {
    const payload = req.body || {}
    if (typeof payload.isPrimary === 'string') payload.isPrimary = payload.isPrimary === 'true' || payload.isPrimary === '1'
    const file = req.file
    let msvFileUrl = null
    if (file) {
      msvFileUrl = `/uploads/${file.filename}`
    }

    const item = await updateVendor(req.params.id, { ...payload, msvFileUrl })
    if (!item) return res.status(404).json({ message: 'Vendor not found' })

    // Also persist on public.vendors for this vendor name if provided
    if (payload.vendor && msvFileUrl) {
      try {
        await query(
          `UPDATE public.vendors SET msv_file_url = $2, updated_at = NOW()
           WHERE vendor_name_norm = lower($1)`,
          [payload.vendor, msvFileUrl]
        )
      } catch {}
    }

    res.json(item)
  } catch (err) { next(err) }
}

// Download MSV file for a given vendor-client id
export async function downloadMsv(req, res, next) {
  try {
    const id = req.params.id
    const { rows } = await query(
      `SELECT v.msv_file_url
       FROM public.vendor_clients vc
       JOIN public.vendors v ON v.vendor_id = vc.vendor_id
       WHERE vc.id = $1
       LIMIT 1`,
      [id]
    )
    const url = rows[0]?.msv_file_url || null
    if (!url) return res.status(404).json({ message: 'MSV file not found' })

    if (url.startsWith('/uploads/')) {
      const uploadsDir = path.resolve(process.cwd(), 'backend', 'uploads')
      const filename = path.basename(url) // guard against traversal
      const abs = path.join(uploadsDir, filename)
      if (!abs.startsWith(uploadsDir)) {
        return res.status(400).json({ message: 'Invalid file path' })
      }
      if (!fs.existsSync(abs)) return res.status(404).json({ message: 'MSV file missing on server' })
      const ext = path.extname(filename).toLowerCase()
      const contentType = ext === '.pdf' ? 'application/pdf'
        : ext === '.doc' ? 'application/msword'
        : 'application/octet-stream'
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`)
      return res.sendFile(abs)
    }
    // Fallback for absolute/external URLs: redirect to the file
    return res.redirect(302, url)
  } catch (err) { next(err) }
}
