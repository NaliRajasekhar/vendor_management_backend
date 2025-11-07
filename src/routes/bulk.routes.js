import { Router } from 'express'
import { upload, uploadVendorClientsCsv } from '../controllers/bulk.controller.js'

const router = Router()
router.post('/vendor-clients', upload.single('file'), uploadVendorClientsCsv)

export default router

