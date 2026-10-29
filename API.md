# ShareOn API

Base URL: `/api`. JSON in/out. Auth: `Authorization: Bearer <JWT>` (from register/login).
Money is returned in **integer cents (EUR)**; money sent by clients is in **euros** (e.g. `8.5`) and only
accepted for listing inputs (price per day, replacement value, requested/approved amounts). All rental
prices and fees are computed on the server.

Errors: `{ "error": { "code": "BAD_REQUEST", "message": "Slovak message", "details": [{ "path": "email", "message": "…" }] } }`
Status codes: 400 validation · 401 not logged in · 403 forbidden · 404 not found · 409 conflict/state · 429 rate limited.

Legend: 🔓 public · 🔑 logged in · 👑 admin

## Auth
| Method | Path | | Body / notes |
|---|---|---|---|
| POST | `/auth/register` | 🔓 | `{ name, email, password, phone, city }` → `{ token, user }` (role always USER) |
| POST | `/auth/login` | 🔓 | `{ email, password }` → `{ token, user }` |
| POST | `/auth/logout` | 🔑 | Revokes **all** tokens of the user |
| GET | `/auth/me` | 🔑 | `{ user: { …, rating, stats, unreadNotifications } }` |

## Users
| Method | Path | | |
|---|---|---|---|
| GET | `/users/:id` | 🔓 | Public profile (no phone/e-mail), rating summary, stats, active items |
| PATCH | `/users/me` | 🔑 | `{ name?, phone?, city?, bio?, avatarUrl? }` |
| GET | `/users/:id/reviews` | 🔓 | `{ summary: { average, count, distribution }, reviews }` |
| GET | `/users/me/items` | 🔑 | Own items incl. inactive *(extra)* |
| GET | `/users/me/favorites` | 🔑 | Favorite items *(extra)* |

## Rental modes & pricing
Items can be rented **na dni (DAILY)**, **na hodiny (HOURLY)** or both (`dailyRentalEnabled`, `hourlyRentalEnabled`).

- **Daily rule:** start and end date are both included – `12.–14. 10.` = **3 days**. Same day = 1 day.
- **Hourly rule:** one calendar day, `startTime < endTime` (no midnight crossing), 15-minute steps, within the item's
  `availableFromTime`–`availableToTime`, between `minRentalHours`–`maxRentalHours`. Durations are stored in **minutes**.
- Times are Europe/Bratislava wall-clock time; each rental also stores its exact UTC interval (`startAt`, `endAt`).
- Overlaps are checked against reserved rentals (ACCEPTED…DISPUTED) **including `bufferHours`** on both sides.
- Prices (all server-side): hourly `rentalPrice = minutes × pricePerHour / 60`, daily `rentalPrice = days × pricePerDay`;
  `total = rentalPrice + protectionFee + platformFee`. **There is no deposit** (legacy `depositCents`/`refundableCents`
  columns are always 0 for new rentals and are never returned).
- **Ochrana prenájmu** is included in every rental (hourly and daily): `protectionFee = clamp(round(rentalPrice × 10 %), 0,50 €, 5,00 €)`.
  Examples: 5 € → 0,50 € (5,50 €), 12 € → 1,20 € (13,20 €), 30 € → 3,00 € (33,00 €), 80 € → 5,00 € (85,00 €), 120 € → 5,00 € (125,00 €).
  It is an internal ShareOn mechanism; compensation is never automatic. Payments are simulated in the MVP.

| Method | Path | | |
|---|---|---|---|
| POST | `/pricing/quote` | 🔓 | `{ itemId, rentalMode: DAILY\|HOURLY, startDate, endDate? (daily), startTime?, endTime? (hourly, HH:MM) }` → `{ quote: { available, period: { …, label }, price } }`. Validates mode, past dates, availability window, hours/min/max, overlaps + buffer. **Read-only – never creates a rental request.** 400/409 with a Slovak message when not available. |

`price` = `{ rentalMode, durationMinutes, durationDays, units, unit, pricePerUnitCents, rentalPriceCents, protectionFeeCents, platformFeeCents, totalCents, currency, protection }`

## Items
| Method | Path | | |
|---|---|---|---|
| GET | `/items` | 🔓 | Query: `q, category (one or comma list, e.g. WORKSHOP,GARDEN), city, mode=DAILY\|HOURLY, minPrice, maxPrice, condition (comma list), from, to (YYYY-MM-DD), protection=true, favorites=true, ownerId, sort=newest\|price_asc\|price_desc\|rating\|popular (most rented, then newest), page, limit` – each card also has `district`, `distanceKm` (approx. from Košice centre, null without district) and `availableToday` |
| GET | `/items/:id` | 🔓 | Detail incl. owner rating, item rating, blocked ranges, 3-day estimate |
| POST | `/items` | 🔑 | `{ title, category, description, city, district? (Košice district name or null), condition, availableFrom, availableTo, replacementValue, serialNote?, protectionEligible, images[1..5], dailyRentalEnabled, hourlyRentalEnabled, dailyPrice?, hourlyPrice?, minRentalHours, maxRentalHours, minRentalDays, maxRentalDays, availableFromTime, availableToTime, bufferHours, declarations: {…} (all true) }` – price required for each enabled mode, at least one mode |
| PATCH | `/items/:id` | 🔑 owner | Partial of the above (+ `isActive`); cannot re-activate admin-deactivated items |
| DELETE | `/items/:id` | 🔑 owner | Hard delete without history, otherwise soft delete; 409 if open rentals |
| POST/DELETE | `/items/:id/favorite` | 🔑 | |
| POST | `/items/:id/report` | 🔑 | Listing report `{ type: ITEM_DIFFERENT_THAN_DESCRIPTION\|USER_BEHAVIOR\|OTHER, description }` |
| GET | `/items/:id/reviews` | 🔓 | Item reviews + summary |

Categories: `GARDEN, SPORT, WORKSHOP, LEISURE, OTHER` · Conditions: `NEW, VERY_GOOD, GOOD, USED, WORN`

## Uploads *(extra)*
| POST | `/uploads` | 🔑 | multipart field `file` (jpg/png/webp, ≤ 5 MB, magic bytes checked) → `{ url: "/uploads/<hex>.jpg" }` |
|---|---|---|---|

## Rental requests
| Method | Path | | |
|---|---|---|---|
| POST | `/rental-requests` | 🔑 | `{ itemId, rentalMode, startDate, endDate? \| startTime+endTime, message?, handoverMethod: PERSONAL_PICKUP\|OWNER_DELIVERY\|MEET_ELSEWHERE, acceptRules: true, acceptProtectionDisclaimer }` – availability and all amounts recalculated server-side; client prices/durations ignored |
| GET | `/rental-requests/sent` | 🔑 | As renter |
| GET | `/rental-requests/received` | 🔑 | As owner |
| GET | `/rental-requests/:id` | 🔑 party/👑 | Full detail, price snapshot (`{ pricePerUnitCents, rentalPriceCents, protectionFeeCents, platformFeeCents, totalCents }`), protection, handover records, `availableActions`, contact details only from ACCEPTED on |
| PATCH | `/rental-requests/:id/status` | 🔑 party | `{ action }` – see table below |
| POST | `/rental-requests/:id/handover` | 🔑 party | `{ note?, photos[] }` – owner = handover with condition photos, renter = receipt. Both → `ACTIVE` |
| POST | `/rental-requests/:id/return` | 🔑 party | `{ note?, photos[], itemOk (owner, required) }` – both → `COMPLETED` (itemOk) or `RETURNED` |
| POST | `/rental-requests/:id/dispute` | 🔑 party | `{ type, description, photos[], contactNote? }` → creates a claim (report), rental `DISPUTED`. Allowed from ACCEPTED until **48 h after the return** |

Status actions:
| action | who | from | to |
|---|---|---|---|
| `ACCEPT` | owner | PENDING | ACCEPTED (+ Ochrana prenájmu record ACTIVE; no deposit) |
| `REJECT` | owner | PENDING | REJECTED |
| `PROPOSE_DATES` `{startDate, endDate (daily) \| startTime+endTime (hourly), note?}` | owner | PENDING | PENDING (proposal stored) |
| `ACCEPT_PROPOSAL` | renter | PENDING + proposal | ACCEPTED (re-priced) |
| `DECLINE_PROPOSAL` | renter | PENDING + proposal | PENDING |
| `CANCEL` | renter (PENDING) / either (ACCEPTED) | | CANCELLED (protection cancelled) |
| `COMPLETE` | owner | RETURNED | COMPLETED |

## Protection
| Method | Path | | |
|---|---|---|---|
| POST | `/protection/quote` | 🔓 | `{ itemId, startDate, endDate }` (stores a ProtectionQuote) **or** `{ category, rentalMode, pricePerDay?, pricePerHour?, replacementValue, rentalDays?, rentalHours? }` (preview for the item form) → `{ quoteId, price, noticeSk, hint }` |
| POST | `/protection/:rentalRequestId/create` | 🔑 party | Idempotent; returns existing record |
| GET | `/protection/:rentalRequestId` | 🔑 party | Record + quotes |
| POST | `/protection/:id/cancel` | 👑 | Audit-logged |

## Feedback
| Method | Path | | |
|---|---|---|---|
| POST | `/feedback` | 🔓 (rate limited 10/h) | `{ type: LIKE\|BUG\|FEATURE\|TESTER, contact? (name or e-mail), message (5–2000) }` – stored, readable by admins only |

## Launch / demand validation
| Method | Path | | |
|---|---|---|---|
| POST | `/launch/waitlist` | 🔓 (20/h) | `{ email, role: BORROW\|LEND\|BOTH, district?, consent: true }` – one row per e-mail (201 new, 200 updated) |
| POST | `/launch/demand` | 🔓 (20/h) | `{ what, email?, district?, consent (required with e-mail) }` – "Čo hľadáš" |
| POST | `/launch/events` | 🔓 (300/15 min) | `{ name: visit_home\|view_search\|view_item\|view_sample_item\|rent_click\|add_item_open }` → 204; anonymous daily counter |
| GET | `/admin/insights?days=30` | 👑 | funnel counts (client + server events: search, rental_request, register, item_created, waitlist, demand, feedback), daily rows, top / zero-result searches, waitlist, demand |

`GET /items?q=…` stores the search text (lower-cased, no user/IP) with its result count. Sample listings (`isDemo`) are listed after real ones and `POST /rental-requests` on them returns 409. Registration requires `acceptTerms: true` (stored as `termsAcceptedAt`).

## Reviews
| Method | Path | | |
|---|---|---|---|
| POST | `/reviews/user` | 🔑 party | `{ rentalRequestId, overall, comment?, … }` renter→owner needs `punctuality, communication, reliability`; owner→renter needs `respectfulUse, onTimeReturn, communication`. Only COMPLETED, once per direction |
| POST | `/reviews/item` | 🔑 renter | `{ rentalRequestId, descriptionAccuracy, itemCondition, valueForMoney, handoverExperience, overall, comment? }` |
| GET | `/users/:id/reviews`, `/items/:id/reviews` | 🔓 | |

## Reports / disputes
| Method | Path | | |
|---|---|---|---|
| POST | `/reports` | 🔑 party | `{ rentalRequestId, type, description, photos[], contactNote? }` – claim; 409 later than 48 h after the return |
| GET | `/reports/:id` | 🔑 participant/👑 | Claim, evidence timeline, status changes (internal notes admin-only), disclaimer; admins also get `rental` (reservation + contacts) |
| POST | `/reports/:id/evidence` | 🔑 participant | `{ text?, fileUrl? }` (NEEDS_MORE_INFORMATION → UNDER_REVIEW) |
| POST | `/reports/:id/response` | 🔑 reported party | `{ text?, fileUrl? }` |

Types offered in the UI: `ITEM_DAMAGED` (Poškodená vec), `ITEM_NOT_RETURNED` (Vec nebola vrátená), `ITEM_DIFFERENT_THAN_DESCRIPTION` (Vec nezodpovedá popisu), `OTHER` (Iný problém); `LATE_RETURN` for overdue rentals. Statuses: `OPEN → UNDER_REVIEW / NEEDS_MORE_INFORMATION → RESOLVED / REJECTED` (legacy `APPROVED`, `PARTIALLY_APPROVED` stay readable).

## Admin 👑
| Method | Path | |
|---|---|---|
| GET | `/admin/overview` *(extra)* | Counters + warning |
| GET | `/admin/users`, `/admin/items`, `/admin/rentals`, `/admin/reports`, `/admin/protection`, `/admin/feedback`, `/admin/reviews` *(extra)*, `/admin/audit-log` | `?q=&status=&take=` |
| PATCH | `/admin/users/:id/deactivate` | `{ active: false\|true }` – revokes sessions |
| PATCH | `/admin/items/:id/deactivate` | `{ active }` |
| PATCH | `/admin/reviews/:id/hide`, `/admin/item-reviews/:id/hide` *(extra)* | `{ hidden }` |
| PATCH | `/admin/reports/:id/status` | `{ status: UNDER_REVIEW\|NEEDS_MORE_INFORMATION\|RESOLVED\|REJECTED, publicNote?, internalNote? }` – stored as a decision + audit log; nothing is approved or paid out automatically |
| GET/PATCH | `/admin/settings` | `{ platformFeeEnabled, platformFeePercentage }` (Ochrana prenájmu pricing is fixed in code; there is no deposit) |

All admin mutations write an `AuditLog` entry (admin id, action, entity, old value, new value, timestamp).

## Misc *(extra)*
| GET | `/settings/public` | 🔓 public protection config + legal texts |
|---|---|---|
| GET | `/notifications` · POST `/notifications/read-all` | 🔑 |
| GET | `/health` | 🔓 |
