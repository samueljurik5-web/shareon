# ShareOn MVP – Product limitations

This MVP exists to **validate real demand** in Košice. It is intentionally limited. Read this before
inviting real users.

## 1. Ochrana prenájmu is not an insurance product
- ShareOn has **no deposit**. Every rental includes **Ochrana prenájmu**: 10 % of the rental price,
  at least 0,50 €, at most 5,00 € (server-side, `services/protection/types.ts`).
- It is an **internal platform mechanism**, not an insurance product, policy or contract. The UI never uses
  the word “poistenie”, never says “100 % poistené” and never claims an insurer covers damages.
- Notice shown wherever the protection is explained (checkout, item form estimate, reservation, protection page):
  > Ochrana prenájmu je služba ShareOn, ktorá pomáha riešiť prípadné škody a spory. Každé hlásenie posudzuje tím
  > ShareOn podľa pravidiel a dostupných dôkazov – náhrada nie je automatická ani garantovaná.
- Offering real insurance later requires a licensed insurance partner and legally reviewed terms
  (incl. insurance-distribution rules such as IDD/IPID).

## 2. Without a deposit, damage is settled case by case
- Nothing is blocked on the renter's card. A damaged or missing item is handled through a claim
  (“Nahlásiť problém”, up to 48 h after the return), photos from the handover/return, ratings and the admin's review.
- Legacy deposit data (rentals created before the change) stays in the database but is never shown or used for totals.

## 3. Payments are not connected
- **Real payments are not connected.** Rental price, Ochrana prenájmu and platform fee are calculated, stored with
  the reservation and *displayed* (“V testovacej verzii sa platby zatiaľ reálne nestrhávajú…”), but not charged.
  The UI says so honestly: the renter pays the owner at handover and does not pay Ochrana prenájmu during the test
  (“Jasná cena vopred” instead of a payment promise). A payment provider (e.g. Stripe Connect) is needed before charging.
- **Sample listings.** The 15 demo items are labelled “Ukážka” and cannot be booked; demo accounts (public password)
  cannot log in in production (`ALLOW_DEMO_LOGIN` unset).

## 4. Compensation decisions are not automatic
- Opening a claim never approves or pays anything. The admin changes its status
  (UNDER_REVIEW / NEEDS_MORE_INFORMATION / RESOLVED / REJECTED) with public and internal notes; every change is audit-logged.
- Shown to users: *“ShareOn neposkytuje automatické rozhodnutie o škode ani automatickú náhradu…”*

## 5. Legal & compliance
- **Legal documents (terms, rules, privacy policy) require professional legal review.** The in-app rules are a short draft.
- **GDPR and consumer law must be verified before public launch** (lawful basis, retention, data subject
  rights, DPA with hosting providers, cookie policy, consumer information duties, ODR/ADR, DSA obligations for platforms).
- Identity verification (KYC) is not implemented.

## 6. Functional simplifications
| Area | MVP behaviour | Extension point |
|---|---|---|
| Search | In-memory sort/filter on ≤ 300 candidates | Postgres full-text / dedicated search |
| Messaging | Request message + contact details after acceptance | In-app chat |
| Notifications | In-app only | E-mail / push |
| Uploads | Local disk, magic-byte validation, no resizing / EXIF stripping / malware scan | `StorageProvider` (S3, Cloudinary) |
| Auth | JWT bearer token in localStorage; logout revokes all sessions (tokenVersion) | httpOnly cookies + refresh tokens, e-mail verification, password reset |
| Disputes | Resolving/deciding the last open report moves a disputed rental to COMPLETED | Richer resolution states |
| Pending requests | Only accepted rentals block the calendar; several pending requests may overlap until the owner accepts one | Auto-reject overlapping pending requests |
| Cancellation | Renter cancels while pending; either party may cancel an accepted rental before handover | Cancellation policy & fees |
| Rental length | Daily: inclusive days within the item's min/max (≤ 90). Hourly: single day, 15-min steps, within the item's time window | Overnight / multi-day hourly slots, per-weekday opening hours |
