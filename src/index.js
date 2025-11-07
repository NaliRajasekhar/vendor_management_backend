import dotenv from 'dotenv'
dotenv.config()

import { createServer } from 'http'
import app from './app.js'
import { ensureIdentity } from './migrations/ensure_identity.js'
import { ensureContactsMsvFile } from './migrations/ensure_contacts_msv_file.js'
import { ensureVendorsMsvFile } from './migrations/ensure_vendors_msv_file.js'
import { ensureVendorClientsMsaSignedDate } from './migrations/ensure_vendor_clients_msa_signed_date.js'
import { ensureDepartments } from './migrations/ensure_departments.js'

const port = Number(process.env.PORT || 4000)
const server = createServer(app)

// Run lightweight migrations before starting the server
await ensureIdentity()
await ensureContactsMsvFile()
await ensureVendorsMsvFile()
await ensureVendorClientsMsaSignedDate()
await ensureDepartments()

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
