import { query } from '../config/db.js'

export async function searchVendors(req, res, next) {

  console.log("req.query", req.query);
  try {
    const q = String(req.query.q || '').trim().toLowerCase()
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 500)
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0)

    let rows
    let total = 0
    if (q) {
      const like = `%${q}%`
      const cnt = await query(`SELECT COUNT(*) AS total FROM public.vendors WHERE vendor_name_norm LIKE $1`, [like])
      total = Number(cnt.rows[0]?.total || 0)
      const result = await query(
        `SELECT vendor_id, vendor_name, website, linkedin_url, vendor_city, vendor_state, msv_file_url, created_at, updated_at
         FROM public.vendors
         WHERE vendor_name_norm LIKE $1
         ORDER BY vendor_name
         LIMIT $2 OFFSET $3`,
        [like, limit, offset]
      )
      rows = result.rows
    } else {
      const cnt = await query(`SELECT COUNT(*) AS total FROM public.vendors`)
      total = Number(cnt.rows[0]?.total || 0)
      const result = await query(
        `SELECT vendor_id, vendor_name, website, linkedin_url, vendor_city, vendor_state, msv_file_url, created_at, updated_at
         FROM public.vendors
         ORDER BY vendor_name
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      )
      rows = result.rows
    }

    res.json({ items: rows, limit, offset, total })
  } catch (err) { next(err) }
}

export async function searchClients(req, res, next) {
  try {
    const q = String(req.query.q || '').trim().toLowerCase()
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 500)
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0)

    let rows
    let total = 0
    if (q) {
      const like = `%${q}%`
      const cnt = await query(
        `SELECT COUNT(*) AS total FROM public.vendor_clients vc
         WHERE vc.client_name_norm LIKE $1 OR vc.email_norm LIKE $1 OR vc.implementation_partner_norm LIKE $1`,
        [like]
      )
      total = Number(cnt.rows[0]?.total || 0)
      const result = await query(
        `SELECT vc.id, v.vendor_id, v.vendor_name, vc.client_name, vc.implementation_partner_name,vc.msa,
                vc.contact_person_name, vc.department, vc.email, vc.phone, vc.client_city, vc.client_state,
                vc.created_at, vc.updated_at
         FROM public.vendor_clients vc
         JOIN public.vendors v ON v.vendor_id = vc.vendor_id
         WHERE vc.client_name_norm LIKE $1
         OR vc.email_norm LIKE $1
         OR vc.implementation_partner_norm LIKE $1
         ORDER BY vc.created_at DESC
         LIMIT $2 OFFSET $3`,
        [like, limit, offset]
      )
      rows = result.rows
    } else {
      const cnt = await query(`SELECT COUNT(*) AS total FROM public.vendor_clients`)
      total = Number(cnt.rows[0]?.total || 0)
      const result = await query(
        `SELECT vc.id, v.vendor_id, v.vendor_name, vc.client_name, vc.implementation_partner_name,vc.msa,
                vc.contact_person_name, vc.department, vc.email, vc.phone, vc.client_city, vc.client_state,
                vc.created_at, vc.updated_at
         FROM public.vendor_clients vc
         JOIN public.vendors v ON v.vendor_id = vc.vendor_id
         ORDER BY vc.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      )
      rows = result.rows
    }

    res.json({ items: rows, limit, offset, total })
  } catch (err) { next(err) }
}

// List vendor options for dropdowns: id + name
export async function listVendorOptions(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT vendor_id, vendor_name
       FROM public.vendors
       ORDER BY vendor_name`
    )
    res.json({ items: rows })
  } catch (err) { next(err) }
}

// List client names for dropdown, optionally filtered by vendor_id
export async function listClientOptions(req, res, next) {
  try {
    const vendorId = req.query.vendor_id ? parseInt(String(req.query.vendor_id), 10) : null
    let result
    if (vendorId && !Number.isNaN(vendorId)) {
      result = await query(
        `SELECT DISTINCT client_name
         FROM public.vendor_clients
         WHERE vendor_id = $1 AND client_name IS NOT NULL AND client_name <> ''
         ORDER BY client_name`,
        [vendorId]
      )
    } else {
      result = await query(
        `SELECT DISTINCT client_name
         FROM public.vendor_clients
         WHERE client_name IS NOT NULL AND client_name <> ''
         ORDER BY client_name`
      )
    }
    res.json({ items: result.rows.map(r => ({ client_name: r.client_name })) })
  } catch (err) { next(err) }
}

// Vendor clients filtered by vendor_id, optional q, limit, offset
export async function vendorClientsByVendor(req, res, next) {
  try {
    const vendorId = parseInt(String(req.query.vendor_id || ''), 10)
    if (!vendorId || Number.isNaN(vendorId)) {
      return res.status(400).json({ message: 'vendor_id is required' })
    }
    const q = String(req.query.q || '').trim().toLowerCase()
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 500)
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0)

    let rows
    let total = 0
    if (q) {
      const like = `%${q}%`
      const cnt = await query(
        `SELECT COUNT(*) AS total FROM public.vendor_clients vc
         WHERE vc.vendor_id = $1 AND (lower(vc.client_name) LIKE $2 OR lower(vc.department) LIKE $2 OR lower(vc.contact_person_name) LIKE $2 OR lower(vc.email) LIKE $2)`,
        [vendorId, like]
      )
      total = Number(cnt.rows[0]?.total || 0)
      const result = await query(
        `SELECT vc.id, v.vendor_name, vc.client_name, vc.implementation_partner_name,
                vc.contact_person_name, vc.department, vc.email, vc.phone, vc.client_city, vc.client_state,
                vc.created_at, vc.updated_at
         FROM public.vendor_clients vc
         JOIN public.vendors v ON v.vendor_id = vc.vendor_id
         WHERE vc.vendor_id = $1 AND (
              lower(vc.client_name) LIKE $2 OR lower(vc.department) LIKE $2 OR lower(vc.contact_person_name) LIKE $2 OR lower(vc.email) LIKE $2
         )
         ORDER BY vc.created_at DESC
         LIMIT $3 OFFSET $4`,
        [vendorId, like, limit, offset]
      )
      rows = result.rows
    } else {
      const cnt = await query(`SELECT COUNT(*) AS total FROM public.vendor_clients vc WHERE vc.vendor_id = $1`, [vendorId])
      total = Number(cnt.rows[0]?.total || 0)
      const result = await query(
        `SELECT vc.id, v.vendor_id, v.vendor_name, vc.client_name, vc.implementation_partner_name,
                vc.contact_person_name, vc.department, vc.email, vc.phone, vc.client_city, vc.client_state,
                vc.created_at, vc.updated_at
         FROM public.vendor_clients vc
         JOIN public.vendors v ON v.vendor_id = vc.vendor_id
         WHERE vc.vendor_id = $1
         ORDER BY vc.created_at DESC
         LIMIT $2 OFFSET $3`,
        [vendorId, limit, offset]
      )
      rows = result.rows
    }

    res.json({ items: rows, limit, offset, vendor_id: vendorId, total })
  } catch (err) { next(err) }
}
// Vendor list filtered by client_name, optional q, limit, offset
export async function vendorClientsByClient(req, res, next) {
  try {
    const clientName = String(req.query.client_name || '').trim()
    if (!clientName) {
      return res.status(400).json({ message: 'client_name is required' })
    }
    const q = String(req.query.q || '').trim().toLowerCase()
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 500)
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0)

    let rows
    let total = 0
    if (q) {
      const like = `%${q}%`
      const cnt = await query(
        `SELECT COUNT(*) AS total FROM public.vendor_clients vc
         WHERE lower(vc.client_name) = lower($1) AND (
           lower(vc.implementation_partner_name) LIKE $2 OR lower(vc.contact_person_name) LIKE $2 OR lower(vc.department) LIKE $2 OR lower(vc.email) LIKE $2
         )`,
        [clientName, like]
      )
      total = Number(cnt.rows[0]?.total || 0)
      const result = await query(
        `SELECT vc.id, v.vendor_id, v.vendor_name, vc.client_name, vc.implementation_partner_name,
                vc.contact_person_name, vc.department, vc.email, vc.phone, vc.client_city, vc.client_state,
                vc.created_at, vc.updated_at
         FROM public.vendor_clients vc
         JOIN public.vendors v ON v.vendor_id = vc.vendor_id
         WHERE lower(vc.client_name) = lower($1) AND (
              lower(vc.implementation_partner_name) LIKE $2 OR lower(vc.contact_person_name) LIKE $2 OR lower(vc.department) LIKE $2 OR lower(vc.email) LIKE $2
         )
         ORDER BY vc.created_at DESC
         LIMIT $3 OFFSET $4`,
        [clientName, like, limit, offset]
      )
      rows = result.rows
    } else {
      const cnt = await query(`SELECT COUNT(*) AS total FROM public.vendor_clients vc WHERE lower(vc.client_name) = lower($1)`, [clientName])
      total = Number(cnt.rows[0]?.total || 0)
      const result = await query(
        `SELECT vc.id, v.vendor_id, v.vendor_name, vc.client_name, vc.implementation_partner_name,
                vc.contact_person_name, vc.department, vc.email, vc.phone, vc.client_city, vc.client_state,
                vc.created_at, vc.updated_at
         FROM public.vendor_clients vc
         JOIN public.vendors v ON v.vendor_id = vc.vendor_id
         WHERE lower(vc.client_name) = lower($1)
         ORDER BY vc.created_at DESC
         LIMIT $2 OFFSET $3`,
        [clientName, limit, offset]
      )
      rows = result.rows
    }

    res.json({ items: rows, limit, offset, client_name: clientName, total })
  } catch (err) { next(err) }
}

// Global search across vendor name or client name; returns vendor_clients rows
export async function globalVendorClientSearch(req, res, next) {
  try {
    const q = String(req.query.q || '').trim().toLowerCase()
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 500)
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0)

    if (!q) {
      // If empty query, behave like latest vendor_clients
      const cnt = await query(`SELECT COUNT(*) AS total FROM public.vendor_clients`)
      const total = Number(cnt.rows[0]?.total || 0)
      const result = await query(
        `SELECT vc.id, v.vendor_id, v.vendor_name, vc.client_name, vc.implementation_partner_name,vc.msa,
                vc.contact_person_name, vc.department, vc.email, vc.phone, vc.client_city, vc.client_state,
                vc.created_at, vc.updated_at
         FROM public.vendor_clients vc
         JOIN public.vendors v ON v.vendor_id = vc.vendor_id
         ORDER BY vc.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      )
      return res.json({ items: result.rows, limit, offset, total })
    }

    const like = `%${q}%`
    const cnt = await query(
      `SELECT COUNT(*) AS total FROM public.vendor_clients vc
       JOIN public.vendors v ON v.vendor_id = vc.vendor_id
       WHERE lower(v.vendor_name) LIKE $1
          OR lower(vc.client_name) LIKE $1
          OR lower(vc.email) LIKE $1
          OR lower(vc.phone) LIKE $1
          OR lower(vc.client_state) LIKE $1
          OR lower(v.vendor_state) LIKE $1
          OR lower(vc.implementation_partner_name) LIKE $1
          OR lower(vc.contact_person_name) LIKE $1`,
      [like]
    )
    const total = Number(cnt.rows[0]?.total || 0)
    const result = await query(
      `SELECT vc.id, v.vendor_id, v.vendor_name, vc.client_name, vc.implementation_partner_name,vc.msa,
              vc.contact_person_name, vc.department, vc.email, vc.phone, vc.client_city, vc.client_state,
              vc.created_at, vc.updated_at
       FROM public.vendor_clients vc
       JOIN public.vendors v ON v.vendor_id = vc.vendor_id
       WHERE lower(v.vendor_name) LIKE $1
           OR lower(vc.client_name) LIKE $1
           OR lower(vc.email) LIKE $1
           OR lower(vc.phone) LIKE $1
           OR lower(vc.client_state) LIKE $1
           OR lower(v.vendor_state) LIKE $1
           OR lower(vc.implementation_partner_name) LIKE $1
           OR lower(vc.contact_person_name) LIKE $1
       ORDER BY vc.created_at DESC
       LIMIT $2 OFFSET $3`,
      [like, limit, offset]
    )
    res.json({ items: result.rows, limit, offset, total })
  } catch (err) { next(err) }
}
