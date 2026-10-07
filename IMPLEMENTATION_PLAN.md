# ShareOn – Implementation Plan

## 0. Repository inspection
The repository was empty (no existing frontend, backend, DB or package manager). A new
project is initialized as an **npm workspaces monorepo**:

| Layer      | Choice |
|------------|--------|
| Frontend   | React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7 (`client/`) |
| Backend    | Node.js 22, Express 5, TypeScript, Zod (`server/`) |
| Database   | PostgreSQL 16 + Prisma ORM 6 |
| Auth       | JWT (Bearer, httpOnly-free – token kept in memory/localStorage for MVP) + bcrypt |
| Uploads    | Multer + storage abstraction (local disk in dev, S3/Cloudinary extension point) |
| Tests      | Vitest + Supertest (API integration tests against a dedicated test DB) |
| Infra      | Docker Compose (postgres + server + client) |

## Phases
1. **Scaffold** – workspaces, TS configs, ESLint, Docker Compose, env files.
2. **Database** – Prisma schema (all models/enums from spec), migration, seed (8 users, 15 items, 10 rentals, reviews, quotes, reports).
3. **Backend core** – config, error handling, validation, rate limiting, CORS, helmet, auth (register/login/logout/me), RBAC & ownership middleware.
4. **Domain services** – pricing (server-side), protection provider abstraction (`NoProtectionProvider`, `MockProtectionProvider`, `ExternalInsuranceProviderPlaceholder`), mock deposit provider, rental state machine, handover/return, reports/disputes, reviews, notifications, audit log, settings.
5. **API routes** – exactly as listed in the spec (see API.md).
6. **Tests** – auth, items, rentals, pricing, protection, deposits, reviews, reports, admin, access control.
7. **Frontend** – Neon Night ShareOn design system, layout (desktop nav + mobile bottom nav), all routes, Slovak UI, states (loading/empty/error/toast/confirm modal).
8. **Docs** – README, API.md, SECURITY_NOTES.md, PRODUCT_LIMITATIONS.md, .env.example.
9. **Verification** – typecheck, lint, tests, build, migrate, seed; fix all errors.

## Key product guard-rails
- Default `protectionMode = PROTECTION_FEE`; `INSURANCE` is rejected unless a real provider is configured (`INSURANCE_PROVIDER_*` env vars) – the placeholder provider throws.
- Mock protection & mock deposits are always labelled “DEMO / TEST MODE” / “SIMULATED PAYMENT”.
- No automatic compensation: every report requires an explicit admin decision, which is audit-logged.
- All prices/fees/deposits computed on the server; client values are ignored.

## Status
All phases implemented. Verified with: `npm run typecheck`, `npm run lint`, `npm test`
(58 server + 7 client tests), `npm run build`, `prisma migrate deploy`, `npm run db:seed`, and a
Playwright run of the full rental flow in the browser (request → accept → handover → return →
completed → reviews) on mobile and desktop viewports. Docker images are defined but could not be
built in the authoring sandbox (no Docker daemon).

## Deviations / decisions
- `bcryptjs` (pure-JS bcrypt) instead of native `bcrypt` – same algorithm, no native build step.
- Images are uploaded via a dedicated `POST /api/uploads` endpoint; items/evidence reference the returned URLs.
- Extra endpoints beyond the spec (listed as *extra* in API.md): uploads, notifications, public settings,
  admin overview/reviews/hide, deposit withhold, own items/favorites.
- Rental days = end − start (1.10.–4.10. = 3 days; same day = 1). Deposit = 30 % of replacement value (whole euros, capped).

## Phase: rental modes (daily + hourly)
- Prisma: `RentalMode` enum; Item rental settings (prices per mode, min/max hours/days, daily time window, buffer);
  RentalRequest stores mode, local dates/times, UTC `startAt/endAt`, `durationMinutes|durationDays`, `pricePerUnitCents`,
  `refundableCents`. Hand-written, data-preserving migrations (`20261007090000_rental_modes`, `20261007091000_…`) with
  CHECK constraints; existing rentals converted to the inclusive day rule.
- Services: `calculateRentalPrice()` (single pricing source), `resolvePeriod()` + `checkItemAvailability()` (mode, past,
  window, min/max, overlaps incl. buffer), Europe/Bratislava time helpers without extra dependencies.
- API: `POST /api/pricing/quote` (read-only); rental creation/acceptance/proposals revalidate and reprice on the server.
- UI: mode chooser („Ako dlho si chceš predmet požičať?“), hourly/daily forms with live server quote, owner rental settings,
  mode-aware cards, request detail (exact times, late-return flag), requests list, admin rentals table, search filter.
- Column naming: amounts keep the project's `…Cents` convention (e.g. `hourlyPriceCents`, `rentalPriceCents`, `totalCents`).
