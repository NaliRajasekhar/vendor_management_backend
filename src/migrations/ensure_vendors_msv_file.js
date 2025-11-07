import { query } from '../config/db.js'

export async function ensureVendorsMsvFile() {
  try {
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='vendors' AND column_name='msv_file_url'
        ) THEN
          EXECUTE 'ALTER TABLE public.vendors ADD COLUMN msv_file_url TEXT NULL';
        END IF;
      END$$;`)
  } catch (e) {
    console.error('Migration ensureVendorsMsvFile failed:', e.message)
  }
}

