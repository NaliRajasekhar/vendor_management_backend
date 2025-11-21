import { query } from '../config/db.js'

const BUILTIN_ROLES = ['admin', 'employee', 'user']

export async function ensureUsersTable() {
  try {
    await query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    await query(`
      CREATE TABLE IF NOT EXISTS public.user_roles (
        id BIGSERIAL PRIMARY KEY,
        role_name TEXT NOT NULL UNIQUE
      );
    `)

    await query(
      `
      INSERT INTO public.user_roles(role_name)
      SELECT role_name FROM unnest($1::text[]) AS roles(role_name)
      ON CONFLICT (role_name) DO NOTHING;
      `,
      [BUILTIN_ROLES]
    )

    await query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        first_name TEXT NULL,
        last_name TEXT NULL,
        role_id BIGINT NOT NULL REFERENCES public.user_roles(id),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
      ON public.users (LOWER(email));
    `)

    await query(`
      DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
      CREATE TRIGGER users_set_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `)
  } catch (err) {
    console.error('Migration ensureUsersTable failed:', err.message)
  }
}
