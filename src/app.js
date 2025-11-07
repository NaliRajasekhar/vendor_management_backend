import express from 'express'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import morgan from 'morgan'
import vendorsRouter from './routes/vendors.routes.js'
import contactsRouter from './routes/contacts.routes.js'
import searchRouter from './routes/search.routes.js'
import authRouter from './routes/auth.routes.js'
import bulkRouter from './routes/bulk.routes.js'
import dashboardRouter from './routes/dashboard.routes.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

// Serve uploaded files and ensure directory exists
const uploadsDir = path.resolve(process.cwd(), 'backend', 'uploads')
try { fs.mkdirSync(uploadsDir, { recursive: true }) } catch {}
app.use('/uploads', express.static(uploadsDir))

app.get('/healthz', (_req, res) => res.json({ ok: true }))

app.use('/api/vendors', vendorsRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/auth', authRouter)
app.use('/api/search', searchRouter)
app.use('/api/bulk', bulkRouter)
app.use('/api/dashboard', dashboardRouter)

app.use(notFound)
app.use(errorHandler)

export default app
