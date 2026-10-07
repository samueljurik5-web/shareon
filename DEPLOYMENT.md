# Deploying ShareOn

## Architecture in production

```
Browser ──HTTPS──▶ Render Web Service "shareon" (Node 22)
                    ├─ Express API          /api/*
                    ├─ uploaded images      /uploads/*   (local disk – see limitations)
                    └─ React build (Vite)   /*           (CLIENT_DIST_DIR=../client/dist)
                         │
                         └──▶ Render PostgreSQL "shareon-db"
```

One web service serves both the API and the frontend, so there is a single URL and no CORS setup.

## Option A – Render Blueprint (recommended for testing)

1. Push the repo (including `render.yaml`) to GitHub.
2. Render Dashboard → **New → Blueprint** → choose `samueljurik5-web/shareon`.
3. When asked, enter **`SEED_ADMIN_PASSWORD`** (min. 12 characters, keep it private).
   `JWT_SECRET` is generated automatically by Render.
4. Click **Deploy Blueprint**. The first build takes ~3–5 minutes.
5. Open `https://shareon.onrender.com` (or `https://shareon-xxxx.onrender.com` if the name is taken – shown in the dashboard).

What happens on each start: `prisma migrate deploy` → demo seed **only if the database is empty** → start server.

Logins after the first deploy:
- Admin: `admin@shareon.local` / the `SEED_ADMIN_PASSWORD` you entered
- Demo users: `jana@example.sk`, `martin@example.sk`, … / `Heslo12345` (public demo accounts)

To stop seeding demo data (e.g. before real users), set `DEMO_SEED_ON_EMPTY=false`.

## Environment variables

| Variable | Required | Value |
|---|---|---|
| `NODE_ENV` | yes | `production` |
| `DATABASE_URL` | yes | from the Render database (`fromDatabase` in render.yaml) |
| `JWT_SECRET` | yes | random ≥ 32 chars (Render `generateValue`) |
| `CLIENT_DIST_DIR` | yes (single service) | `../client/dist` |
| `SEED_ADMIN_PASSWORD` | when demo seed runs | private, ≥ 12 chars |
| `DEMO_SEED_ON_EMPTY` | no | `true` for demo, `false` for real use |
| `NODE_VERSION` | yes on Render | `22` |
| `RATE_LIMIT_ENABLED` | no | `true` |
| `CORS_ORIGINS` | only if the frontend is hosted elsewhere | e.g. `https://shareon.vercel.app` |
| `INSURANCE_*` | **must stay empty** | – |

## Option B – Vercel (frontend) + Render/Railway (API) + Neon/Render (PostgreSQL)

Vercel can host the **static React build only**. The Express server should not run on Vercel without
rework (in-memory rate limiting, local-disk uploads and long-lived Prisma connections don't fit serverless
functions), and Vercel has no built-in Postgres (it offers Neon via its marketplace).

- Vercel project: root `client`, build `npm run build`, output `dist`, env `VITE_API_URL=https://<api-host>`,
  plus a rewrite of all routes to `/index.html`.
- API host: set `CORS_ORIGINS=https://<vercel-domain>` and leave `CLIENT_DIST_DIR` unset.
- Vercel Hobby is for **non-commercial** use only; a commercial launch needs Pro (~$20/user/month).

## Costs (approximate, check current pricing)

| Setup | Monthly | Notes |
|---|---|---|
| Render free web + free Postgres | €0 | sleeps after 15 min idle (~1 min cold start); free DB **expires after 30 days**, 1 GB |
| Render Starter web + Basic Postgres | ~$7 + ~$6 | always on, persistent DB with backups |
| + persistent disk for uploads | ~$0.25/GB | required to keep uploaded photos on Render |
| Vercel Pro (if frontend on Vercel, commercial) | ~$20/user | Hobby is non-commercial only |

## Limitations of the demo deployment
- **Uploaded photos are lost** on every redeploy/restart on the free plan (ephemeral disk). Add a Render disk
  mounted at `/opt/render/project/src/server/uploads` (paid) or implement an S3/Cloudinary `StorageProvider`.
- Free database is deleted after 30 days (+14-day grace) unless upgraded.
- Demo user passwords are public – anyone with the URL can log in as a demo user and change demo data.
- Payments are simulated and protection is not insurance (see PRODUCT_LIMITATIONS.md). Do not invite the public
  before the legal/GDPR work in PRODUCT_LIMITATIONS.md is done.

## Troubleshooting: "Render deployed, but the app looks old / hourly rentals are missing"

1. **Check which commit is live:** open `https://<your-service>.onrender.com/api/health` → `{"ok":true,"version":"<short commit>"}`.
   The same version is shown in the page footer (desktop) and at the bottom of the Profile page.
2. **Hard-refresh the browser** (iPad Safari: close the tab, or Settings → Safari → Clear History and Website Data).
   Since this fix, `index.html` is sent with `Cache-Control: no-cache` and hashed assets are `immutable`, so new deploys are
   picked up on the next page load.
3. **Data vs. code:** the database survives deploys. A database seeded before hourly rentals existed has only daily items
   (the migration safely defaults existing items to daily-only). With `DEMO_SEED_ON_EMPTY=true`, the start step runs a
   one-time **demo-data upgrade** (tracked in `AppSetting.demoDataVersion`) that enables hourly rental on the built-in
   demo items owned by the demo accounts. Look for `[demo-data] upgraded to version 2` in the deploy log.
   Real users' items are never changed – owners enable hourly rental in *Upraviť predmet → Spôsob prenájmu*.
4. **Migrations:** the deploy log must show either `Applying migration …` or `No pending migrations to apply` with
   `3 migrations found` (or more).
