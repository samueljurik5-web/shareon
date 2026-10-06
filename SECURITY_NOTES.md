# ShareOn – Security notes

## Implemented
| Control | Where |
|---|---|
| Password hashing with bcrypt (cost 12, `bcryptjs`), timing-safe login with dummy hash | `server/src/routes/auth.ts` |
| JWT (HS256, explicit algorithm, expiry) + **revocation** via `User.tokenVersion` (logout, admin deactivation) | `middleware/auth.ts` |
| Every request re-loads the user → deactivated users lose access immediately | `middleware/auth.ts` |
| Role-based access (`requireAdmin`) and ownership checks (item owner, rental party, report participant) | routes + `services/rentals.ts`, `services/reports.ts` |
| Zod validation of every body/query; unknown keys stripped or rejected (`.strict()` for settings/profile) | `middleware/validate.ts` |
| Prisma parameterized queries only (one `$executeRaw` tagged template for row locking) | – |
| **Server-side prices**: rental, protection fee, deposit, platform fee, total computed on server; client amounts ignored | `services/pricing.ts` |
| Server-side state machine for rental statuses (`availableActions`) + optimistic locking on status | `services/rentals.ts` |
| Row lock on item when accepting to prevent double booking | `lockItem()` |
| Idempotency: protection record & deposit keyed by `rental:<id>:protection|deposit` (unique) | `services/protection/records.ts`, `services/deposit` |
| Deposit state machine with terminal states | `services/deposit/transitions.ts` |
| Contact info (phone/e-mail) only shown to the counterparty after acceptance; public profiles never show them | `routes/rentals.ts`, `lib/serialize.ts` |
| Admin internal notes never sent to non-admins | `services/reports.ts#serializeReport` |
| Audit log for every admin action (old/new value, admin id, timestamp) | `services/audit.ts` |
| Upload validation: MIME allow-list (jpg/png/webp), **magic-byte sniffing**, size limit, executable/SVG/HTML blocking, random filenames, no client filename used, 1 file/request | `services/storage` |
| Uploaded files served with `nosniff` + `Content-Security-Policy: default-src 'none'` | `app.ts` |
| Only URLs from our own storage can be referenced in items/evidence (regex + existence check) | `lib/validation.ts` |
| Rate limiting (global API, stricter for auth & uploads) | `middleware/rateLimit.ts` |
| Helmet security headers, CORS allow-list, JSON body limit 100 kB, `x-powered-by` disabled | `app.ts` |
| Safe error responses (no stack traces); logs contain method/path/message only – never bodies, passwords or tokens | `middleware/error.ts` |
| Env validation; production refuses `dev-only*` JWT secret; INSURANCE mode refused without configured provider | `config/env.ts`, `services/settings.ts` |
| Seed refuses to run in production unless `ALLOW_SEED=true` | `prisma/seed.ts` |

## Known gaps / before production
- Token stored in `localStorage` (XSS exposure). Move to httpOnly, `SameSite=strict` cookies + CSRF protection and short-lived access + refresh tokens.
- No e-mail verification, password reset, 2FA for admins, or account lockout beyond rate limits.
- Rate limiter uses in-memory store → use Redis for multiple instances.
- Uploads: add image re-encoding (strips EXIF/GPS metadata and polyglots), malware scanning, object storage with signed URLs.
- Add CSP for the SPA (nginx), HSTS, HTTPS-only deployment.
- Dependency scanning (npm audit / Dependabot), secret scanning, backups and PITR for PostgreSQL.
- GDPR: data export/deletion endpoints, retention policy for reports/evidence and audit logs.
- Penetration test before public launch.
