import bcrypt from 'bcryptjs'
import { query } from '../config/db.js'
import { createAuthToken } from '../middleware/auth.js'

function mapUserRow(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role_name
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' })

    const { rows } = await query(
      `
      SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.is_active, r.role_name
      FROM public.users u
      JOIN public.user_roles r ON r.id = u.role_id
      WHERE lower(u.email) = lower($1)
      LIMIT 1;
      `,
      [email]
    )
    const userRow = rows[0]
    if (!userRow || !userRow.password_hash) return res.status(401).json({ message: 'Invalid credentials' })
    if (userRow.is_active === false) return res.status(403).json({ message: 'Account disabled' })

    const ok = await bcrypt.compare(password, userRow.password_hash)
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })

    const user = mapUserRow(userRow)
    const token = createAuthToken({ id: user.id, email: user.email, role: user.role })
    return res.json({ token, user })
  } catch (err) { next(err) }
}

export async function currentUser(req, res, next) {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' })
    const { rows } = await query(
      `
      SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, r.role_name
      FROM public.users u
      JOIN public.user_roles r ON r.id = u.role_id
      WHERE u.id = $1
      LIMIT 1;
      `,
      [req.user.id]
    )
    const user = mapUserRow(rows[0])
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (rows[0].is_active === false) return res.status(403).json({ message: 'Account disabled' })
    return res.json({ user })
  } catch (err) { next(err) }
}


