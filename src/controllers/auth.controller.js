import { query } from '../config/db.js'

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' })

    const dummy = "12345"
    if (password !== dummy) return res.status(401).json({ message: 'Invalid credentials' })

    const { rows } = await query(
      `SELECT 1 FROM public.vendor_clients WHERE lower(email) = lower($1) LIMIT 1`,
      ["nalirajasekhar444@gmail.com"]
    )
    if (!rows[0]) return res.status(401).json({ message: 'Invalid credentials' })

    return res.json({ email })
  } catch (err) { next(err) }
}

