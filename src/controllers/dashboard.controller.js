import { query } from '../config/db.js'

export async function summary(_req, res, next) {
  
  try {
    const sql = `
      WITH vendor_status AS (
        SELECT
          vendor_id,
          bool_or(COALESCE(msa, false)) AS is_active
        FROM public.vendor_clients
        GROUP BY vendor_id
      )
      SELECT
        (SELECT COUNT(*) FROM vendor_status) AS vendor_count,
        (SELECT COUNT(*) FROM vendor_status WHERE is_active = true) AS active_vendor_count,
        (SELECT COUNT(*) FROM vendor_status WHERE is_active = false) AS inactive_vendor_count,
        (SELECT COUNT(DISTINCT client_name) FROM public.vendor_clients WHERE client_name IS NOT NULL AND client_name <> '') AS client_count,
        (SELECT COUNT(*) FROM public.vendor_clients WHERE msa = true) AS msa_count
    `
    const { rows } = await query(sql)
    const row = rows[0] || { vendor_count: 0, client_count: 0, msa_count: 0, active_vendor_count: 0, inactive_vendor_count: 0 }
    res.json({
      vendors: Number(row.vendor_count) || 0,
      clients: Number(row.client_count) || 0,
      msa: Number(row.msa_count) || 0,
      activeVendors: Number(row.active_vendor_count) || 0,
      inactiveVendors: Number(row.inactive_vendor_count) || 0,
    })
  } catch (err) { next(err) }
}
