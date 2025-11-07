import { query } from '../config/db.js'

const COLUMNS = [
  'id','vendor','implementation','client','is_primary','name','phone','email','department','state','city','msa_signed_date','msv_file_url','created_at','updated_at'
]

const toApi = (row) => ({
  id: row.id,
  vendor: row.vendor,
  implementation: row.implementation,
  client: row.client,
  isPrimary: row.is_primary,
  name: row.name,
  phone: row.phone,
  email: row.email,
  department: row.department,
  state: row.state,
  city: row.city,
  msaSignedDate: row.msa_signed_date,
  msvFileUrl: row.msv_file_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export async function listContacts() {
  const { rows } = await query(`SELECT ${COLUMNS.join(', ')} FROM contacts ORDER BY created_at DESC`)
  return rows.map(toApi)
}

export async function getContact(id) {
  const { rows } = await query(`SELECT ${COLUMNS.join(', ')} FROM contacts WHERE id = $1`, [id])
  return rows[0] ? toApi(rows[0]) : null
}

export async function createContact(id, data) {
  const { rows } = await query(
    `INSERT INTO contacts (id, vendor, implementation, client, is_primary, name, phone, email, department, state, city, msa_signed_date, msv_file_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING ${COLUMNS.join(', ')}`,
    [
      id,
      data.vendor || null,
      data.implementation || null,
      data.client || null,
      data.isPrimary === true,
      data.name || null,
      data.phone || null,
      data.email || null,
      data.department || null,
      data.state || null,
      data.city || null,
      data.msaSignedDate || null,
      data.msvFileUrl || null
    ]
  )
  return toApi(rows[0])
}

export async function updateContact(id, data) {
  const fields = [
    ['vendor', data.vendor],
    ['implementation', data.implementation],
    ['client', data.client],
    ['is_primary', data.isPrimary],
    ['name', data.name],
    ['phone', data.phone],
    ['email', data.email],
    ['department', data.department],
    ['state', data.state],
    ['city', data.city],
    ['msa_signed_date', data.msaSignedDate],
    ['msv_file_url', data.msvFileUrl]
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
  if (!sets.length) {
    const current = await getContact(id)
    return current
  }
  values.push(id)
  const { rows } = await query(
    `UPDATE contacts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING ${COLUMNS.join(', ')}`,
    values
  )
  return rows[0] ? toApi(rows[0]) : null
}

export async function deleteContact(id) {
  const { rowCount } = await query(`DELETE FROM contacts WHERE id = $1`, [id])
  return rowCount > 0
}
