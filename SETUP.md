# InStock — Backend Setup (Vercel Postgres)

The app now stores users, sessions, and equipment data in a real database
so anyone who logs in sees the same data on every device.

## One-time Vercel setup

1. Open your project in the Vercel dashboard.
2. Go to the **Storage** tab → **Create Database** → **Postgres**.
   Pick the free Hobby tier and the region closest to you.
3. After it provisions, click **Connect Project**. Vercel will inject
   these env vars into your project automatically:
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
   - `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`

   You don't have to set anything by hand — `@vercel/postgres` reads them.
4. Push your code (`git push`). The next deploy will see the database.

That's it. There are **no migrations to run** — the API auto-creates
the tables on the first request and seeds:

- Organization: **University of Notre Dame** (`org_nd`)
- Admin user: **`admin` / `admin123`**

## Local development against the real database

If you want to run `npm run dev` locally and have it talk to the same
database (instead of an isolated localStorage):

```bash
npm install -g vercel
vercel link            # connects this folder to your Vercel project
vercel env pull        # writes .env.local with the POSTGRES_* vars
npm run dev
```

Without `.env.local`, `npm run dev` will still serve the frontend, but
API calls to `/api/*` won't work because Vite's dev server doesn't run
serverless functions. To run the full stack locally you can use
`vercel dev` instead of `npm run dev`.

## Architecture

```
Browser (React)
   ├─ /api/auth/signup      ─┐
   ├─ /api/auth/login        │  Vercel Serverless Functions
   ├─ /api/auth/logout       │  (Node.js, in api/)
   ├─ /api/auth/me           │
   └─ /api/state (GET, PUT) ─┘
                              │
                              ▼
                         Vercel Postgres
                         ├─ organizations
                         ├─ users          (scrypt-hashed passwords)
                         ├─ sessions       (HTTP-only cookie tokens)
                         └─ org_state      (JSONB blob per org)
```

- Passwords are salted + hashed with `crypto.scrypt` before they hit the DB.
- Sessions are stored DB-side; the browser only ever sees a random
  HTTP-only cookie token (not the password, not a JWT).
- All equipment / categories / contacts / logs for an organization live
  in a single `org_state` JSONB row, with optimistic concurrency via a
  `version` column. If two people edit at the same time, the second
  save gets a 409 and the UI prompts a refresh instead of clobbering.

## Adding more organizations

Right now Notre Dame is the only valid org (per the spec). To add more,
insert a row into `organizations` and add it to `KNOWN_ORGS` in
`src/Login.jsx`. A future `/api/organizations` admin endpoint can replace
the hardcoded list.

## Files added by the backend work

```
api/
├── _lib/
│   ├── db.js            schema bootstrap + Notre Dame / admin seed
│   └── auth.js          scrypt + cookie helpers
├── auth/
│   ├── login.js
│   ├── signup.js
│   ├── logout.js
│   └── me.js
└── state.js             GET / PUT shared org state

src/
├── App.jsx              auth + state hydration
├── Login.jsx            sign-in / create-account
├── authService.js       client wrapper around /api/auth/*
└── stateService.js      client wrapper around /api/state
```
