# ShareOn – MVP

> **Požičaj si viac. Kupuj menej.** A peer-to-peer marketplace for borrowing and renting things
> from people nearby. Launch market: **Košice, Slovakia**. UI language: **Slovak**.

ShareOn MVP covers the full rental loop: registration → listing → search → rental request →
accept/reject/propose dates → server-side pricing (rental price, protection fee, refundable
deposit, optional platform fee) → handover checklist → return checklist → completion → mutual
ratings + item rating → disputes with evidence → admin decision with audit log.

> ⚠️ **ShareOn Rental Protection is not insurance coverage.** Payments and deposits are **simulated**.
> Read [PRODUCT_LIMITATIONS.md](PRODUCT_LIMITATIONS.md) before showing this to real users.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router 7 (`client/`) |
| Backend | Node.js 22, Express 5, TypeScript, Zod, JWT, bcrypt (bcryptjs) (`server/`) |
| Database | PostgreSQL 16, Prisma ORM 6 |
| Tests | Vitest + Supertest (API), Vitest + Testing Library (UI) |
| Infra | npm workspaces, Docker Compose (postgres + API + nginx-served client) |

Design system **Neon Night ShareOn** lives in `client/src/styles/index.css` (tokens under `@theme`,
components such as `.card`, `.btn-primary`, `.chip`, `.badge-*`, `.notice`).

## Prerequisites

- Node.js **22+** and npm 10+
- PostgreSQL **16** (local install or via Docker)
- (optional) Docker + Docker Compose v2

## Environment variables

All variables are documented in [`.env.example`](.env.example). The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | Separate DB used by `npm test` (tables are truncated!) |
| `JWT_SECRET` | ≥ 32 chars, random. Server refuses `dev-only*` secrets in production |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `UPLOAD_DIR`, `UPLOAD_MAX_BYTES` | Local image storage |
| `RATE_LIMIT_ENABLED` | `true` by default |
| `INSURANCE_*` | Must stay empty until a real insurance partner exists |

## Local setup

```bash
npm install                              # installs both workspaces
cp .env.example server/.env              # adjust DATABASE_URL / JWT_SECRET

# create databases (example for a local postgres superuser)
psql -U postgres -c "CREATE USER shareon WITH PASSWORD 'shareon' CREATEDB;"
psql -U postgres -c "CREATE DATABASE shareon OWNER shareon;"
psql -U postgres -c "CREATE DATABASE shareon_test OWNER shareon;"

npm run db:deploy                        # apply migrations (or: npm run db:migrate for dev)
npm run db:seed                          # ⚠️ deletes all data in DATABASE_URL and inserts demo data
npm run dev                              # API on :4000, client on :5173 (proxies /api and /uploads)
```

Open http://localhost:5173.

## Docker setup

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose up --build -d             # db, server (runs `prisma migrate deploy`), client
# demo data (DESTRUCTIVE – demo databases only):
docker compose exec -e ALLOW_SEED=true server node dist/prisma/seed.js
```

App: http://localhost:8080 · API: http://localhost:4000/api/health

## Migrations & seed

| Command | What it does |
|---|---|
| `npm run db:migrate` | `prisma migrate dev` – create/apply migrations in development |
| `npm run db:deploy` | `prisma migrate deploy` – apply committed migrations (CI / prod) |
| `npm run db:seed` | Reset **all** data and insert 8 users, 15 items, 10 rentals, reviews, quotes, reports |

The seed refuses to run when `NODE_ENV=production` unless `ALLOW_SEED=true`.

## Test users (development only)

| Role | E-mail | Password |
|---|---|---|
| Admin | `admin@shareon.local` | `AdminShareOn2024` |
| User | `jana@example.sk` (garden tools owner) | `Heslo12345` |
| User | `martin@example.sk` (workshop owner, has an open dispute) | `Heslo12345` |
| User | `lucia@example.sk`, `peter@example.sk`, `zuzana@example.sk`, `tomas@example.sk`, `eva@example.sk` | `Heslo12345` |

> 🔐 **These credentials are public. Change or delete them before any production deployment.**

## Tests, lint, typecheck, build

```bash
npm run typecheck     # tsc (server + client)
npm run lint          # eslint (server + client)
npm test              # server: 58 API/unit tests against TEST_DATABASE_URL; client: component tests
npm run build         # server → server/dist, client → client/dist
```

Server tests apply migrations to the test DB with `prisma migrate deploy` and truncate tables
between test files – never point `TEST_DATABASE_URL` at a database with real data.

## Project structure

```
server/
  prisma/schema.prisma, migrations/, seed.ts
  src/config        env validation
  src/middleware    auth (JWT + tokenVersion revocation), validation, rate limits, errors
  src/routes        auth, users, items, rental-requests, protection, deposits, reviews, reports, admin, uploads
  src/services      pricing, rentals (state machine), reports, reviews, settings, audit, notifications
  src/services/protection   ProtectionProvider + NoProtection / Mock / ExternalInsurancePlaceholder
  src/services/deposit      DepositProvider + MockDepositProvider + state machine
  src/services/storage      StorageProvider + LocalStorageProvider + image validation
  tests/            Vitest + Supertest
client/
  src/pages         all routes incl. /admin/*
  src/components    design-system components (ItemCard, PriceBreakdown, ProtectionNotice, …)
```

See also: [DEPLOYMENT.md](DEPLOYMENT.md) · [API.md](API.md) · [SECURITY_NOTES.md](SECURITY_NOTES.md) · [PRODUCT_LIMITATIONS.md](PRODUCT_LIMITATIONS.md) · [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

## ⚠️ Production warnings

- **No real insurance.** `PROTECTION_FEE` mode uses `MockProtectionProvider` (labelled *DEMO / TEST MODE*).
  `INSURANCE` mode is rejected until a real insurance partner, contract, terms and legal review exist.
- **No real payments.** Deposits are `SIMULATED PAYMENT`; nothing is charged, held or refunded.
- **Compensation is never automatic** – only an explicit admin decision records an approved amount, and nothing is paid out.
- Replace seed credentials, set a strong `JWT_SECRET`, restrict `CORS_ORIGINS`, use HTTPS.
- Replace local file storage with object storage (S3/Cloudinary) + malware scanning.
- Terms of service, privacy policy (GDPR) and consumer-law compliance require professional legal review.
