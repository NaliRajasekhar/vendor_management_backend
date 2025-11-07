export function notFound(_req, res, _next) {
  res.status(404).json({ message: 'Not Found' })
}

export function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || 500
  let message = err.message || 'Internal Server Error'
  const details = err.details

  // Multer upload errors
  if (err?.name === 'MulterError') {
    status = 400
    message = `Upload failed: ${err.message}`
  }
  // Postgres common errors
  if (err?.code) {
    switch (String(err.code)) {
      case '23505': // unique_violation
        status = 409
        message = 'A record with the same value already exists.'
        break
      case '23503': // foreign_key_violation
        status = 400
        message = 'This record is linked to another and cannot be changed.'
        break
      default:
        break
    }
  }

  res.status(status).json({ message, ...(details ? { details } : {}) })
}
