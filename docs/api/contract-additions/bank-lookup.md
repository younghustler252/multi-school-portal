# Bank list and account verification (school payment setup)

Shared types and request schema: `packages/contracts/src/bank-lookup.ts`. Module notes: `docs/backend/modules/school.md`.

| Method | Path | Guards | Success `data` |
|---|---|---|---|
| GET | `/api/v1/schools/banks` | authenticate, tenant, `school.payments.manage`, verified school, 60 req/min per user | `[{ name, code }]`, sorted by name |
| POST | `/api/v1/schools/payment-setup/verify` | same guards, 20 req/min per user | `{ accountName, accountNameMatchesSchool }` |

Request body of verify: `{ bankCode: string (2-10), accountNumber: string (10 digits) }`, strict (a `password` is refused).

Errors (envelope `{ success:false, message, code? }`)
- 400 `Validation failed` with `errors` per field.
- 400 `Could not verify bank account. Please check the account number and bank` — the provider said no (400/404/422).
- 503 `BANK_LOOKUP_UNAVAILABLE` — timeout, provider down or our provider key rejected; retry.
- 403 `SCHOOL_NOT_VERIFIED`, 403 permission, 401, 404 school.
- 429 `{ success:false, message }` from the limiter; counted per signed-in user id (IP only if somehow unauthenticated).

Design notes
- Verify is a POST so the account number stays out of URLs and logs; it does not echo the number and writes nothing.
- The preview and `POST /schools/payment-setup` use one name-match rule, so they cannot disagree.
- Route inventory: `docs/api/PLATFORM_COMMUNICATION_OPERATION_INVENTORY.md` (School section 24 -> 26, total 128 -> 130).
