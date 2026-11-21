# Invoice payment history

Types: `packages/contracts/src/invoice-payments.ts`. Both routes are read-only, under the existing `/fees` mounts, and return only payments that are **CONFIRMED** with a live (not reversed) allocation to the invoice, newest first.

| Method | Path | Guards | `data` |
|---|---|---|---|
| GET | `/api/v1/fees/invoices/:id/payments` | authenticate, tenant, `fees.invoices.view` **and** `payments.view`, plan feature `modules.fees` | `StaffInvoicePayment[]` |
| GET | `/api/v1/fees/my/invoices/:id/payments` | authenticate, tenant, `fees.view`, `modules.fees`; invoice must be an issued invoice of the viewer's own child (or the student) | `FamilyInvoicePayment[]` |

Why not `GET /payments?invoiceId=`: that route is staff-only and returns whole payments. A payment can pay several invoices, so the invoice screen needs the amount allocated to this invoice, and guardians have no other way to read it.

- Staff item: `{ paymentId, receiptNumber, method, status, reference, paidOn, recordedAt, allocatedKobo, paymentTotalKobo }`
- Family item: `{ paymentId, receiptNumber, method, status, paidOn, allocatedKobo }` (no payer identity, gateway reference, notes or payment total)
- `paidOn` is `yyyy-mm-dd`; money uses the shared `koboOut` format (number when safe, else digit string). (The proposal said `paidAt`; this uses the payments module's existing `paidOn` convention.)

Errors
- 404 `Invoice not found`: unknown invoice; and on the family route also another family's invoice, a draft or a void invoice. Never 403, so nothing about another family's invoice is confirmed.
- 403: missing permission or plan feature (a role with `fees.invoices.view` but not `payments.view` is refused on the staff route). 401 unauthenticated.

Inventory: Finance inventory Fees 43 -> 45, total 190 -> 192.
