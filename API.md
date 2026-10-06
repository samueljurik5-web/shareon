# ShareOn API

Base URL: `/api`. JSON in/out. Auth: `Authorization: Bearer <JWT>` (from register/login).
Money is returned in **integer cents (EUR)**; money sent by clients is in **euros** (e.g. `8.5`) and only
accepted for listing inputs (price per day, replacement value, requested/approved amounts). All rental
prices and fees are computed on the server.

Errors: `{ "error": { "code": "BAD_REQUEST", "message": "Slovak message", "details": [{ "path": "email", "message": "…" }] } }`
Status codes: 400 validation · 401 not logged in · 403 forbidden · 404 not found · 409 conflict/state · 429 rate limited · 501 insurance not available.

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

## Items
| Method | Path | | |
|---|---|---|---|
| GET | `/items` | 🔓 | Query: `q, category, city, minPrice, maxPrice, condition (comma list), from, to (YYYY-MM-DD), protection=true, favorites=true, ownerId, sort=newest\|price_asc\|price_desc\|rating, page, limit` |
| GET | `/items/:id` | 🔓 | Detail incl. owner rating, item rating, blocked ranges, 3-day estimate |
| POST | `/items` | 🔑 | `{ title, category, description, pricePerDay, city, condition, availableFrom, availableTo, replacementValue, serialNote?, protectionEligible, images[1..5], declarations: { rightToOffer, accurateDescription, damageDisclosed, photosCurrent } (all true) }` |
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
| POST | `/rental-requests` | 🔑 | `{ itemId, startDate, endDate, message?, handoverMethod: PERSONAL_PICKUP\|OWNER_DELIVERY\|MEET_ELSEWHERE, acceptRules: true, acceptProtectionDisclaimer }` – prices computed server-side; extra fields ignored |
| GET | `/rental-requests/sent` | 🔑 | As renter |
| GET | `/rental-requests/received` | 🔑 | As owner |
| GET | `/rental-requests/:id` | 🔑 party/👑 | Full detail, price snapshot, protection, deposit, handover records, `availableActions`, contact details only from ACCEPTED on |
| PATCH | `/rental-requests/:id/status` | 🔑 party | `{ action }` – see table below |
| POST | `/rental-requests/:id/handover` | 🔑 party | `{ note?, photos[] }` – owner = handover with condition photos, renter = receipt. Both → `ACTIVE` |
| POST | `/rental-requests/:id/return` | 🔑 party | `{ note?, photos[], itemOk (owner, required) }` – both → `COMPLETED` (itemOk) or `RETURNED` |
| POST | `/rental-requests/:id/dispute` | 🔑 party | `{ type, description, requestedAmount, photos[] }` → creates report, rental `DISPUTED`, deposit `DISPUTED` |

Status actions:
| action | who | from | to |
|---|---|---|---|
| `ACCEPT` | owner | PENDING | ACCEPTED (+ protection record, simulated deposit HELD) |
| `REJECT` | owner | PENDING | REJECTED |
| `PROPOSE_DATES` `{startDate,endDate,note?}` | owner | PENDING | PENDING (proposal stored) |
| `ACCEPT_PROPOSAL` | renter | PENDING + proposal | ACCEPTED (re-priced) |
| `DECLINE_PROPOSAL` | renter | PENDING + proposal | PENDING |
| `CANCEL` | renter (PENDING) / either (ACCEPTED) | | CANCELLED (protection cancelled, deposit released) |
| `COMPLETE` | owner | RETURNED | COMPLETED (deposit released) |

## Protection
| Method | Path | | |
|---|---|---|---|
| POST | `/protection/quote` | 🔓 | `{ itemId, startDate, endDate }` (stores a ProtectionQuote) **or** `{ category, pricePerDay, replacementValue, rentalDays, protectionEligible }` (preview) → `{ quoteId, price, notice, demoLabel, … }` |
| POST | `/protection/:rentalRequestId/create` | 🔑 party | Idempotent; returns existing record |
| GET | `/protection/:rentalRequestId` | 🔑 party | Record + quotes |
| POST | `/protection/:id/cancel` | 👑 | Audit-logged |

## Deposits (SIMULATED PAYMENT)
| Method | Path | | |
|---|---|---|---|
| POST | `/deposits/:rentalRequestId/create` | 🔑 party | Idempotent |
| GET | `/deposits/:rentalRequestId` | 🔑 party | |
| POST | `/deposits/:id/release` | 🔑 owner (not while DISPUTED) / 👑 | |
| POST | `/deposits/:id/withhold` | 👑 | `{ amount? }` full or partial *(extra)* |

Deposit transitions: `PENDING→HELD|RELEASED`, `HELD→RELEASE_REQUESTED|RELEASED|DISPUTED|PARTIALLY_WITHHELD|WITHHELD`,
`RELEASE_REQUESTED→RELEASED|DISPUTED`, `DISPUTED→RELEASED|PARTIALLY_WITHHELD|WITHHELD`; `RELEASED`, `WITHHELD`, `PARTIALLY_WITHHELD`, `NOT_REQUIRED` are terminal.

## Reviews
| Method | Path | | |
|---|---|---|---|
| POST | `/reviews/user` | 🔑 party | `{ rentalRequestId, overall, comment?, … }` renter→owner needs `punctuality, communication, reliability`; owner→renter needs `respectfulUse, onTimeReturn, communication`. Only COMPLETED, once per direction |
| POST | `/reviews/item` | 🔑 renter | `{ rentalRequestId, descriptionAccuracy, itemCondition, valueForMoney, handoverExperience, overall, comment? }` |
| GET | `/users/:id/reviews`, `/items/:id/reviews` | 🔓 | |

## Reports / disputes
| Method | Path | | |
|---|---|---|---|
| POST | `/reports` | 🔑 party | `{ rentalRequestId, type, description, requestedAmount, photos[] }` |
| GET | `/reports/:id` | 🔑 participant/👑 | Report, evidence timeline, decisions (internal notes admin-only), disclaimer |
| POST | `/reports/:id/evidence` | 🔑 participant | `{ text?, fileUrl? }` (NEEDS_MORE_INFORMATION → UNDER_REVIEW) |
| POST | `/reports/:id/response` | 🔑 reported party | `{ text?, fileUrl? }` |

Types: `ITEM_DAMAGED, ITEM_NOT_RETURNED, ITEM_DIFFERENT_THAN_DESCRIPTION, USER_BEHAVIOR, PAYMENT_PROBLEM, OTHER`

## Admin 👑
| Method | Path | |
|---|---|---|
| GET | `/admin/overview` *(extra)* | Counters + warning |
| GET | `/admin/users`, `/admin/items`, `/admin/rentals`, `/admin/reports`, `/admin/protection`, `/admin/deposits`, `/admin/reviews` *(extra)*, `/admin/audit-log` | `?q=&status=&take=` |
| PATCH | `/admin/users/:id/deactivate` | `{ active: false\|true }` – revokes sessions |
| PATCH | `/admin/items/:id/deactivate` | `{ active }` |
| PATCH | `/admin/reviews/:id/hide`, `/admin/item-reviews/:id/hide` *(extra)* | `{ hidden }` |
| PATCH | `/admin/reports/:id/status` | `{ status: UNDER_REVIEW\|NEEDS_MORE_INFORMATION\|RESOLVED, note? }` |
| POST | `/admin/reports/:id/decision` | `{ decision: APPROVED\|PARTIALLY_APPROVED\|REJECTED, approvedAmount, publicNote?, internalNote?, depositAction: NONE\|RELEASE\|WITHHOLD\|PARTIAL_WITHHOLD, withheldAmount? }` – records decision only, no payout |
| GET/PATCH | `/admin/settings` | `{ protectionMode, protectionActive, minProtectionFeeCents, protectionPercentage, maxProtectedValueCents, depositPercentage, maxDepositCents, allowedCategories, platformFeeEnabled, platformFeePercentage }` – INSURANCE rejected without configured provider |

All admin mutations write an `AuditLog` entry (admin id, action, entity, old value, new value, timestamp).

## Misc *(extra)*
| GET | `/settings/public` | 🔓 public protection config + legal texts |
|---|---|---|
| GET | `/notifications` · POST `/notifications/read-all` | 🔑 |
| GET | `/health` | 🔓 |
