# MyApp2 Backend (Node + Express + PostgreSQL)

## Setup

1. Copy `.env.example` to `.env` and adjust values.
2. Create the database and run the SQL schema:
   - Create DB: `createdb myapp2` (or via your Postgres tool)
   - Apply schema: run the SQL in `sql/schema.sql` against your database
3. Install dependencies: `npm install`
4. Start in dev mode: `npm run dev`

The API listens on `http://localhost:4000` by default.

## Environment

- `PORT` (default `4000`)
- `CORS_ORIGIN` (default `http://localhost:5173`)
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- `JWT_SECRET` secret for signing auth tokens (default `change-me`)
- `JWT_EXPIRES_IN` token lifetime (default `1d`)

## Endpoints

- Health: `GET /healthz`

- Vendors
  - `GET /api/vendors` — list vendors
  - `GET /api/vendors/:id` — get vendor by id
  - `POST /api/vendors` — create vendor
  - `PUT /api/vendors/:id` — update vendor
  - `DELETE /api/vendors/:id` — soft delete vendor

- Contacts
  - `GET /api/contacts` – list contacts
  - `GET /api/contacts/:id` – get contact by id
  - `POST /api/contacts` – create contact
  - `PUT /api/contacts/:id` – update contact
  - `DELETE /api/contacts/:id` – delete contact

## Users & Roles

- `users` and `user_roles` tables are created automatically by the backend startup migration.
- Default roles seeded into the database: `admin`, `employee`, and `user`.
- Extend the data in `user_roles` if you need additional roles; `users.role_id` references `user_roles.id`.
- Dummy users are inserted at startup so you can sign in right away:
  - `admin@logisoft.com` / `Admin@123`
  - `employee@logisoft.com` / `Employee@123`
  - `user@logisoft.com` / `User@123`
- Update or remove the dummy users after provisioning by editing `src/migrations/seed_users.js`.

## Integrating with the React App

- Set `VITE_API_BASE_URL` in your frontend `.env` to the backend origin, e.g. `http://localhost:4000`.
- The existing `postContact` call in `src/api/index.js` will post to `/api/contacts`.
- If you want to switch Vendors to the backend, replace `src/store/vendors.js` usage with API calls to `/api/vendors`.
