import { Router } from 'express'
import { searchVendors, searchClients, listVendorOptions, vendorClientsByVendor, listClientOptions, vendorClientsByClient, globalVendorClientSearch } from '../controllers/search.controller.js'
import { authorizeRoles } from '../middleware/auth.js'

const router = Router()
router.use(authorizeRoles(['admin', 'employee', 'user']))
router.get('/vendors', searchVendors)
router.get('/clients', searchClients)
router.get('/vendor-options', listVendorOptions)
router.get('/vendor-clients', vendorClientsByVendor)
router.get('/client-options', listClientOptions)
router.get('/client-vendors', vendorClientsByClient)
router.get('/global', globalVendorClientSearch)

export default router
