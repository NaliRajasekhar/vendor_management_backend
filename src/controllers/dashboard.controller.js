import { query } from '../config/db.js'

export async function summary(_req, res, next) {
  console.log("summary");
  
  try {
    // vendor_count from public.vendors
    // client_count from distinct client_name in public.vendor_clients
    // msa_count from contacts where is_primary = true
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM public.vendors) AS vendor_count,
        (SELECT COUNT(DISTINCT client_name) FROM public.vendor_clients WHERE client_name IS NOT NULL AND client_name <> '') AS client_count,
        (SELECT COUNT(*) FROM public.vendor_clients WHERE msa = true) AS msa_count
    `
    const { rows } = await query(sql)
    console.log("rows 15", rows);
    const row = rows[0] || { vendor_count: 0, client_count: 0, msa_count: 0 }
    res.json({
      vendors: Number(row.vendor_count) || 0,
      clients: Number(row.client_count) || 0,
      msa: Number(row.msa_count) || 0,
    })
  } catch (err) { next(err) }
}

