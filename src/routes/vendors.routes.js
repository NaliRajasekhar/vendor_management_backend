import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { index, show, create, update, destroy, createWithFile, updateWithFile, downloadMsv, checkEmail } from '../controllers/vendors.controller.js'
import { authorizeRoles } from '../middleware/auth.js'

const readerRoles = ['admin', 'employee', 'user']
const editorRoles = ['admin', 'employee']

// Upload storage for MSV files (pdf, doc only)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.resolve(process.cwd(), 'backend', 'uploads')),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '_')
    const stamp = Date.now()
    cb(null, `${base}_${stamp}${ext}`)
  }
})
function fileFilter(_req, file, cb) {
  const ok = ['application/pdf', 'application/msword'].includes(file.mimetype)
  if (!ok) return cb(new Error('Only .pdf and .doc files are allowed'))
  cb(null, true)
}
const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } })
const router = Router()
router.get('/', authorizeRoles(readerRoles), index)
router.get('/check-email', authorizeRoles(editorRoles), checkEmail)
router.get('/:id', authorizeRoles(readerRoles), show)
router.get('/:id/msv', authorizeRoles(readerRoles), downloadMsv)
router.post('/', authorizeRoles(editorRoles), create)
// Place file upload route before generic PUT to avoid ambiguous matches
router.put('/:id/with-file', authorizeRoles(editorRoles), upload.single('msv'), updateWithFile)
router.put('/:id', authorizeRoles(editorRoles), update)
router.patch('/:id', authorizeRoles(editorRoles), update)
router.delete('/:id', authorizeRoles(['admin']), destroy)
router.post('/with-file', authorizeRoles(editorRoles), upload.single('msv'), createWithFile)

export default router
