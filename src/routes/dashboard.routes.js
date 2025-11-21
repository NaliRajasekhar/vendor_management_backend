import { Router } from 'express'
import { summary } from '../controllers/dashboard.controller.js'
import { authorizeRoles } from '../middleware/auth.js'

const router = Router()
router.get('/summary', authorizeRoles(['admin', 'employee', 'user']), summary)

export default router

