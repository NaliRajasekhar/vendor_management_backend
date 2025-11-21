import bcrypt from 'bcryptjs'
import { query } from '../config/db.js'

const DEFAULT_USERS = [
  {
    email: 'admin@logisoft.com',
    password: 'Admin@123',
    firstName: 'System',
    lastName: 'Admin',
    role: 'admin'
  },
  {
    email: 'employee@logisoft.com',
    password: 'Employee@123',
    firstName: 'Taylor',
    lastName: 'Employee',
    role: 'employee'
  },
  {
    email: 'user@logisoft.com',
    password: 'User@123',
    firstName: 'Casey',
    lastName: 'User',
    role: 'user'
  }
]

async function getRoleId(roleName) {
  const { rows } = await query(
    `SELECT id FROM public.user_roles WHERE role_name = $1 LIMIT 1`,
    [roleName]
  )
  return rows[0]?.id || null
}

export async function seedUsers() {
  try {
    for (const entry of DEFAULT_USERS) {
      const roleId = await getRoleId(entry.role)
      if (!roleId) continue

      const passwordHash = await bcrypt.hash(entry.password, 10)
      await query(
        `
        INSERT INTO public.users (email, password_hash, first_name, last_name, role_id, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (email) DO UPDATE
          SET password_hash = EXCLUDED.password_hash,
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              role_id = EXCLUDED.role_id,
              is_active = true,
              updated_at = NOW();
        `,
        [entry.email, passwordHash, entry.firstName, entry.lastName, roleId]
      )
    }
  } catch (err) {
    console.error('Migration seedUsers failed:', err.message)
  }
}

