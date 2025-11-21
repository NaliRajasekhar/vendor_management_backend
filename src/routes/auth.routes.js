import { Router } from 'express'
import { login, currentUser } from '../controllers/auth.controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.post('/login', login)
router.get('/me', authenticate, currentUser)

export default router

