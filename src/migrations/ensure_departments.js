import { query } from '../config/db.js'

export async function ensureDepartments() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS public.departments (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`)

    await query(`INSERT INTO public.departments(name)
      VALUES ('Engineering'),('Implementation'),('Support'),('Sales')
      ON CONFLICT (name) DO NOTHING;`)

    await query(`ALTER TABLE public.vendor_clients
      ADD COLUMN IF NOT EXISTS department_id BIGINT NULL REFERENCES public.departments(id);`)

    await query(`INSERT INTO public.departments(name)
      SELECT DISTINCT vc.department FROM public.vendor_clients vc
      WHERE vc.department IS NOT NULL AND trim(vc.department) <> ''
      ON CONFLICT (name) DO NOTHING;`)

    await query(`UPDATE public.vendor_clients vc
      SET department_id = d.id
      FROM public.departments d
      WHERE vc.department_id IS NULL AND d.name = vc.department;`)
  } catch (e) {
    console.error('Migration ensureDepartments failed:', e.message)
  }
}
