import { query } from '../config/db.js'


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
// Map DB rows (join of vendor_clients + vendors) to API shape expected by frontend
const toApi = (row) => ({

  id: row.client_id, // vendor_clients.id
  vendor: row.vendor_name,
  implementation: row.implementation_partner_name,
  client: row.client_name,
  isPrimary: row.msa,
  name: row.contact_person_name,
  designation: row.designation || null,
  phone: row.phone,
  email: row.email,
  department: row.department,
  state: row.client_state,
  city: row.client_city,
  msaSignedDate: row.msa_signed_date || null,
  msvFileUrl: row.msv_file_url || null,
  active: true,
  createdAt: row.client_created_at,
  updatedAt: row.client_updated_at
})

async function findVendorIdByName(vendorName) {
  if (!vendorName) return null
  const { rows } = await query(
    `SELECT vendor_id FROM public.vendors WHERE vendor_name_norm = lower($1) LIMIT 1`,
    [vendorName]
  )
  return rows[0]?.vendor_id || null
}

async function createVendorIfNotExists(vendorName, vendorCity = null, vendorState = null, msvFileUrl = null) {
  // Try find existing vendor by normalized name
  const existingId = await findVendorIdByName(vendorName)
  if (existingId) {
    if (msvFileUrl) {
      await query(
        `UPDATE public.vendors SET msv_file_url = COALESCE(msv_file_url, $2) WHERE vendor_id = $1`,
        [existingId, msvFileUrl]
      )
    }
    return existingId
  }
  // Create vendor; assumes vendor_id is identity or default-generated in DB
  const { rows } = await query(
    `INSERT INTO public.vendors (vendor_name, vendor_city, vendor_state, msv_file_url)
     VALUES ($1, $2, $3, $4)
     RETURNING vendor_id`,
    [vendorName, vendorCity, vendorState, msvFileUrl]
  )
  return rows[0].vendor_id
}

export async function listVendors() {
  const { rows } = await query(
    `SELECT 
       vc.id as client_id,
       v.vendor_name,
       v.msv_file_url,
       vc.msa,
       vc.client_name,
       vc.implementation_partner_name,
       vc.contact_person_name,
       vc.designation,
       vc.department,
       vc.email,
       vc.phone,
       vc.client_city,
       vc.client_state,
       vc.msa_signed_date,
       vc.created_at as client_created_at,
       vc.updated_at as client_updated_at
     FROM public.vendor_clients vc
     JOIN public.vendors v ON v.vendor_id = vc.vendor_id 
      where vc.msa = TRUE
     ORDER BY vc.updated_at DESC`
  )
  
  return rows.map(toApi)
}

export async function getVendor(id) {
  const { rows } = await query(
    `SELECT 
       vc.id as client_id,
       v.vendor_name,
       v.msv_file_url,
       vc.msa,
       vc.client_name,
       vc.implementation_partner_name,
       vc.contact_person_name,
       vc.designation,
       vc.department,
       vc.email,
       vc.phone,
       vc.client_city,
       vc.client_state,
       vc.msa_signed_date,
       vc.created_at as client_created_at,
       vc.updated_at as client_updated_at
     FROM public.vendor_clients vc
     JOIN public.vendors v ON v.vendor_id = vc.vendor_id
     WHERE vc.id = $1
     LIMIT 1`,
    [id]
  )

  return rows[0] ? toApi(rows[0]) : null
}

export async function createVendor(_unusedId, data) {
  // Ensure vendor exists or create it
  const vendorId = await createVendorIfNotExists(
    data.vendor || null,
    null,
    null,
    data.msvFileUrl || null
  )

  // Insert vendor client row; assumes id is identity/default
  const params = [
    vendorId,
    data.client || null,
    data.implementation || null,
    data.isPrimary || null,
    data.name || null,
    data.designation || null,
    data.department || null,
    data.email || null,
    data.phone || null,
    data.city || null,
    data.state || null,
    data.msaSignedDate || null,
    null // notes
  ]
  const { rows } = await query(
    `INSERT INTO public.vendor_clients (
      vendor_id, client_name, implementation_partner_name,msa, contact_person_name, designation, department,
      email, phone, client_city, client_state, msa_signed_date, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING 
       id as client_id,
       (SELECT vendor_name FROM public.vendors WHERE vendor_id = $1) as vendor_name,
       client_name,
       implementation_partner_name,
       msa,
       contact_person_name,
       designation,
       department,
       email,
       phone,
       client_city,
       client_state,
       msa_signed_date,
       created_at as client_created_at,
       updated_at as client_updated_at`,
    params
  )
  return toApi(rows[0])
}

export async function updateVendor(id, data) {
  // Optionally update vendor name if provided
  if (typeof data.vendor !== 'undefined' && data.vendor) {
    // Find vendor_id for this client row
    const { rows: clientRows } = await query(`SELECT vendor_id FROM public.vendor_clients WHERE id = $1`, [id])
    const currentVendorId = clientRows[0]?.vendor_id || null
    if (currentVendorId) {
      await query(`UPDATE public.vendors SET vendor_name = $1, updated_at = NOW() WHERE vendor_id = $2`, [data.vendor, currentVendorId])
    }
  }
  if (typeof data.msvFileUrl !== 'undefined' && data.msvFileUrl) {
    const { rows: clientRows } = await query(`SELECT vendor_id FROM public.vendor_clients WHERE id = $1`, [id])
    const currentVendorId = clientRows[0]?.vendor_id || null
    if (currentVendorId) {
      await query(`UPDATE public.vendors SET msv_file_url = $1, updated_at = NOW() WHERE vendor_id = $2`, [data.msvFileUrl, currentVendorId])
    }
  }

  const fields = [
    ['client_name', data.client],
    ['implementation_partner_name', data.implementation],
    ['msa', data.isPrimary],
    ['contact_person_name', data.name],
    ['designation', data.designation],
    ['department', data.department],
    ['email', data.email],
    ['phone', data.phone],
    ['client_city', data.city],
    ['client_state', data.state],
    ['msa_signed_date', data.msaSignedDate || null]
  ]
  const sets = []
  const values = []
  let idx = 1
  for (const [col, val] of fields) {
    if (typeof val !== 'undefined') {
      sets.push(`${col} = $${idx++}`)
      values.push(val)
    }
  }
  if (!sets.length) return await getVendor(id)
  values.push(id)
  await query(
    `UPDATE public.vendor_clients SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
    values
  )
  return await getVendor(id)
}

export async function deleteVendor(id) {
  const { rowCount } = await query(`DELETE FROM public.vendor_clients WHERE id = $1`, [id])
  return rowCount > 0
}
