import { Router } from 'express'
import { upload, uploadVendorClientsCsv } from '../controllers/bulk.controller.js'
import { authorizeRoles } from '../middleware/auth.js'

const router = Router()
router.post('/vendor-clients', authorizeRoles(['admin']), upload.single('file'), uploadVendorClientsCsv)

export default router

