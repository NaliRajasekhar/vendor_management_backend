
import * as path from 'path'
import dotenv from 'dotenv'
 
// ✅ Explicit absolute path to your .env file
dotenv.config({ path: path.resolve('/opt/www/vendor_management/backend/.env') })
 
import { createServer } from 'http'
import app from './app.js'
import { ensureIdentity } from './migrations/ensure_identity.js'
import { ensureContactsMsvFile } from './migrations/ensure_contacts_msv_file.js'
import { ensureVendorsMsvFile } from './migrations/ensure_vendors_msv_file.js'
import { ensureUsersTable } from './migrations/ensure_users_table.js'
import { seedUsers } from './migrations/seed_users.js'
 
const port = Number(process.env.PORT || 4000)
const server = createServer(app)
 
await ensureIdentity()
await ensureContactsMsvFile()
await ensureVendorsMsvFile()
await ensureUsersTable()
await seedUsers()
 
server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
