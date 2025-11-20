import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'

export function createAuthToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: options.expiresIn || JWT_EXPIRES_IN
  })
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

export function authorizeRoles(...roles) {
  const allowed = roles.flat().filter(Boolean)
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
    if (allowed.length === 0 || allowed.includes(req.user.role)) return next()
    return res.status(403).json({ message: 'Forbidden' })
  }
}
