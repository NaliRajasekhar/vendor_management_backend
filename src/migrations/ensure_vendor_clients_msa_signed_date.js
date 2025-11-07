import { query } from '../config/db.js'

export async function ensureVendorClientsMsaSignedDate() {
  try {
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='vendor_clients' AND column_name='msa_signed_date'
        ) THEN
          EXECUTE 'ALTER TABLE public.vendor_clients ADD COLUMN msa_signed_date DATE NULL';
        END IF;
      END$$;`)
  } catch (e) {
    console.error('Migration ensureVendorClientsMsaSignedDate failed:', e.message)
  }
}

