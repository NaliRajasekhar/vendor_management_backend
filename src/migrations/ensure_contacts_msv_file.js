import { query } from '../config/db.js'

export async function ensureContactsMsvFile() {
  try {
    const { rows } = await query(`SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='contacts'
    ) AS present`)
    const hasTable = Boolean(rows[0]?.present)

    if (hasTable) {
      await query(`ALTER TABLE public.contacts
        ADD COLUMN IF NOT EXISTS msv_file_url TEXT NULL;`)
      return
    }

    await query(`CREATE OR REPLACE VIEW public.contacts AS
      SELECT
        vc.id::text AS id,
        v.vendor_name AS vendor,
        vc.implementation_partner_name AS implementation,
        vc.client_name AS client,
        FALSE AS is_primary,
        vc.contact_person_name AS name,
        vc.phone,
        vc.email,
        vc.department,
        vc.client_state AS state,
        vc.client_city AS city,
        vc.msa_signed_date AS msa_signed_date,
        v.msv_file_url,
        vc.created_at,
        vc.updated_at
      FROM public.vendor_clients vc
      JOIN public.vendors v ON v.vendor_id = vc.vendor_id;`)

    await query(`CREATE OR REPLACE FUNCTION public.contacts_view_ins()
      RETURNS trigger AS $$
      DECLARE
        v_id bigint;
      BEGIN
        IF NEW.vendor IS NULL OR trim(NEW.vendor) = '' THEN
          RAISE EXCEPTION 'vendor is required';
        END IF;

        SELECT vendor_id INTO v_id FROM public.vendors
        WHERE vendor_name_norm = lower(NEW.vendor) LIMIT 1;

        IF v_id IS NULL THEN
          INSERT INTO public.vendors (vendor_name, msv_file_url)
          VALUES (NEW.vendor, NEW.msv_file_url)
          RETURNING vendor_id INTO v_id;
        ELSE
          IF NEW.msv_file_url IS NOT NULL THEN
            UPDATE public.vendors
            SET msv_file_url = NEW.msv_file_url, updated_at = NOW()
            WHERE vendor_id = v_id;
          END IF;
        END IF;

        INSERT INTO public.vendor_clients (
          vendor_id, client_name, implementation_partner_name, contact_person_name,
          department, email, phone, client_city, client_state, msa_signed_date
        ) VALUES (
          v_id, NEW.client, NEW.implementation, NEW.name, NEW.department,
          NEW.email, NEW.phone, NEW.city, NEW.state, NEW.msa_signed_date
        ) RETURNING id INTO NEW.id;

        SELECT vendor_name, msv_file_url INTO NEW.vendor, NEW.msv_file_url FROM public.vendors WHERE vendor_id = v_id;
        NEW.is_primary := FALSE;
        SELECT created_at, updated_at INTO NEW.created_at, NEW.updated_at FROM public.vendor_clients WHERE id = NEW.id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;`)

    await query(`DROP TRIGGER IF EXISTS contacts_view_ins ON public.contacts;`)
    await query(`CREATE TRIGGER contacts_view_ins
      INSTEAD OF INSERT ON public.contacts
      FOR EACH ROW EXECUTE FUNCTION public.contacts_view_ins();`)
  } catch (e) {
    console.error('Migration ensureContactsMsvFile failed:', e.message)
  }
}
