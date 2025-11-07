import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5433),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'Sekhar@123',
  database: process.env.PGDATABASE || 'vmanagement',
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined
})

export const query = (text, params) => pool.query(text, params)
export const getClient = () => pool.connect()

