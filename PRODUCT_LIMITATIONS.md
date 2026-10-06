# ShareOn MVP – Product limitations

This MVP exists to **validate real demand** in Košice. It is intentionally limited. Read this before
inviting real users.

## 1. No real insurance
- **The MVP does not provide real insurance.** Nothing in ShareOn is an insurance product, policy or contract.
- The UI never uses the words “insured” or “insurance included”.
- `protectionMode = INSURANCE` is **rejected** by the API unless a real provider is configured via
  `INSURANCE_PROVIDER_NAME`, `INSURANCE_CONTRACT_REFERENCE`, `INSURANCE_TERMS_URL` and
  `INSURANCE_LEGAL_REVIEW_APPROVED=true`. Even then, `ExternalInsuranceProviderPlaceholder` only throws
  “not available” – it must be implemented against the partner's API.
- **Real insurance requires a real, licensed insurance partner and legally reviewed terms**
  (incl. insurance-distribution rules such as IDD, pre-contractual information/IPID).

## 2. Mock protection is not insurance
- Default mode `PROTECTION_FEE` uses `MockProtectionProvider`, always labelled
  **“DEMO / TEST MODE – Toto nie je skutočné poistné krytie.”**
- The fee is an *internal demo calculation*: `max(1.50 €, value × 2 %) × (1 + max(0, days − 3) × 0.05)`.
  It is **not insurance pricing**. Risk signals are recorded but do not change the fee.
- Required notice (shown on item detail, request form, request detail, add-item estimate, protection page, admin settings):
  > ShareOn Rental Protection is not insurance coverage. It is an internal platform protection mechanism.
  > Compensation is not automatic and is assessed according to ShareOn rules and available evidence.

## 3. Payments are not connected
- **Real payments are not connected** unless a real payment provider is implemented and configured.
  Only `MockDepositProvider` exists; every deposit is labelled **SIMULATED PAYMENT**.
- Rental price, protection fee and platform fee are *displayed* but not charged. Users settle between
  themselves outside the platform during the MVP.

## 4. Compensation decisions are not automatic
- Opening a report never approves anything. Only an admin decision (`POST /api/admin/reports/:id/decision`)
  can set an approved amount, and it is **only recorded** (audit-logged) – no money moves.
- Shown to users: *“ShareOn neposkytuje automatické rozhodnutie o škode. Prípad posudzuje administrátor podľa
  dostupných dôkazov a pravidiel platformy.”*

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
| Cancellation | Renter cancels while pending; either party may cancel an accepted rental before handover | Cancellation policy & fees |
| Rental length | Max 30 days; days = end − start (same day = 1) | Hourly rentals |
