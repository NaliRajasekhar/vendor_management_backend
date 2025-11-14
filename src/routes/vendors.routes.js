import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { index, show, create, update, destroy, createWithFile, downloadMsv, checkEmail } from '../controllers/vendors.controller.js'

const router = Router()
router.get('/', index)
router.get('/check-email', checkEmail)
router.get('/:id', show)
router.get('/:id/msv', downloadMsv)
router.post('/', create)
router.put('/:id', update)
router.patch('/:id', update)
router.delete('/:id', destroy)

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
router.post('/with-file', upload.single('msv'), createWithFile)


export default router
