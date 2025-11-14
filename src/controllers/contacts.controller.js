import { randomUUID } from 'crypto'
import { validateContact } from '../utils/validate.js'
import { listContacts, getContact, createContact, updateContact, deleteContact } from '../models/contacts.model.js'
import { query } from '../config/db.js'

export async function index(_req, res, next) {
  try { res.json(await listContacts()) } catch (err) { next(err) }
}

export async function show(req, res, next) {
  try {
    const item = await getContact(req.params.id)
    if (!item) return res.status(404).json({ message: 'Contact not found' })
    res.json(item)
  } catch (err) { next(err) }
}

export async function create(req, res, next) {
  try {
    const errors = validateContact(req.body || {})
    if (Object.keys(errors).length) {
      const e = new Error('Validation failed')
      e.statusCode = 400
      e.details = errors
      throw e
    }
    const id = randomUUID()
    const item = await createContact(id, req.body)
    res.status(201).json(item)
  } catch (err) { next(err) }
}

// Create with file upload (multipart/form-data)
export async function createWithFile(req, res, next) {
  try {
    const payload = req.body || {}
    // Normalize booleans
    if (typeof payload.isPrimary === 'string') payload.isPrimary = payload.isPrimary === 'true' || payload.isPrimary === '1'

    const errors = validateContact(payload)
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
    const item = await createContact(id, { ...payload, msvFileUrl })
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

export async function update(req, res, next) {
  try {
    const item = await updateContact(req.params.id, req.body || {})
    if (!item) return res.status(404).json({ message: 'Contact not found' })
    res.json(item)
  } catch (err) { next(err) }
}

export async function destroy(req, res, next) {
  try {
    const ok = await deleteContact(req.params.id)
    if (!ok) return res.status(404).json({ message: 'Contact not found' })
    res.status(204).end()
  } catch (err) { next(err) }
}
