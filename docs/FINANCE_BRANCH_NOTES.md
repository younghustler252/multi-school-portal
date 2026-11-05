# Finance and branches

## The rule
- **An invoice carries the branch its student is in when the invoice is made, and keeps it for good.** Generating term invoices bills each student under their own branch, and fee structures that name a branch only apply to students of that branch. A one-off invoice and an opening balance default to the student's branch too (a branch can still be named on a one-off).
- `branchId` in "generate invoices" now means **bill only the students of this branch**. It no longer stamps one branch on everybody.
- Payments, refunds, credit and ledger entries take the branch of the invoice they belong to, so they follow the invoice, not the student.

## When a student transfers to another branch (`POST /students/:id/transfer`)
- Old invoices, payments and ledger entries **stay in the branch where they were made**. That is where the fees were earned, and posted ledger entries are never rewritten.
- New invoices from then on use the new branch.
- If the student still owes money, the transfer response has `finance: { openInvoices, outstandingKobo }` so the school can follow it up. The old balance is still collected and reported under the old branch.
- A student's credit (overpayment) is not tied to a branch and can be used on a new invoice in any branch.

## Not changed (needs a decision from the finance owner)
- **Invoices made before this change** keep whatever branch they had (often none). Branch reports and per-branch ageing therefore only include invoices that have a branch. If you want old invoices counted under a branch, run the optional SQL below in each school once, after checking it. Posted ledger entries are left alone on purpose.
- Staff finance permissions are still school-wide only (`ALL`). A branch-scoped finance role does not exist yet.

```sql
-- OPTIONAL, per school schema, after a backup: give old invoices without a branch their student's branch.
UPDATE "FeeInvoice" i SET "branchId" = s."branchId"
FROM "Student" s WHERE s."id" = i."studentId" AND i."branchId" IS NULL;
```
