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
- `DUMMY_PASSWORD` dummy password required for login (default: `password`)

## Endpoints

- Health: `GET /healthz`

- Vendors
  - `GET /api/vendors` — list vendors
  - `GET /api/vendors/:id` — get vendor by id
  - `POST /api/vendors` — create vendor
  - `PUT /api/vendors/:id` — update vendor
  - `DELETE /api/vendors/:id` — soft delete vendor

- Contacts
  - `GET /api/contacts` — list contacts
  - `GET /api/contacts/:id` — get contact by id
  - `POST /api/contacts` — create contact
  - `PUT /api/contacts/:id` — update contact
  - `DELETE /api/contacts/:id` — delete contact

## Integrating with the React App

- Set `VITE_API_BASE_URL` in your frontend `.env` to the backend origin, e.g. `http://localhost:4000`.
- The existing `postContact` call in `src/api/index.js` will post to `/api/contacts`.
- If you want to switch Vendors to the backend, replace `src/store/vendors.js` usage with API calls to `/api/vendors`.
