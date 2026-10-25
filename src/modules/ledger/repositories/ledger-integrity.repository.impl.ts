import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { IntegrityFinding, MAX_ROWS_PER_CHECK, SystemAccountRow } from "../domain/ledger-integrity";
import { ILedgerIntegrityRepository } from "./ledger-integrity.repository";

/*
| INTEGRITY QUERIES (read-only SQL over the school's own schema). Money is cast to text so that nothing here
| needs BigInt handling, and rows are capped (MAX_ROWS_PER_CHECK) so a badly broken school cannot flood the report.
*/
const day = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export class LedgerIntegrityRepositoryImpl implements ILedgerIntegrityRepository {
    private get db() { return getTenantClient(); }
    private rows(sql: string, ...params: unknown[]) { return this.db.$queryRawUnsafe<any[]>(sql, ...params); }

    async unbalancedJournals(): Promise<IntegrityFinding[]> {
        const rows = await this.rows(
            `SELECT e.id, e.number, e."totalKobo"::text AS total,
                    COALESCE(SUM(l."debitKobo"), 0)::text AS debit, COALESCE(SUM(l."creditKobo"), 0)::text AS credit, COUNT(l.id)::int AS lines
               FROM "JournalEntry" e LEFT JOIN "JournalLine" l ON l."journalId" = e.id
              GROUP BY e.id
             HAVING COUNT(l.id) < 2 OR SUM(l."debitKobo") <> SUM(l."creditKobo") OR SUM(l."debitKobo") <> e."totalKobo"
              ORDER BY e.number LIMIT ${MAX_ROWS_PER_CHECK}`);
        return rows.map(r => ({
            check: "UNBALANCED_JOURNAL" as const, message: `Journal ${r.number} does not balance`,
            details: { journalId: r.id, number: r.number, lines: r.lines, debitKobo: r.debit, creditKobo: r.credit, totalKobo: r.total },
        }));
    }

    async trialBalance(): Promise<IntegrityFinding[]> {
        const [r] = await this.rows(`SELECT COALESCE(SUM("debitKobo"), 0)::text AS debit, COALESCE(SUM("creditKobo"), 0)::text AS credit FROM "JournalLine"`);
        return r.debit === r.credit ? [] : [{
            check: "TRIAL_BALANCE", message: "Total debits do not equal total credits across the school's books",
            details: { debitKobo: r.debit, creditKobo: r.credit },
        }];
    }

    async reversalProblems(): Promise<IntegrityFinding[]> {
        const missing = await this.rows(
            `SELECT e.id, e.number FROM "JournalEntry" e
              WHERE e.status = 'REVERSED' AND NOT EXISTS (SELECT 1 FROM "JournalEntry" r WHERE r."reversalOfId" = e.id)
              ORDER BY e.number LIMIT ${MAX_ROWS_PER_CHECK}`);
        const unmarked = await this.rows(
            `SELECT r.id, r.number, o.number AS "originalNumber" FROM "JournalEntry" r JOIN "JournalEntry" o ON o.id = r."reversalOfId"
              WHERE o.status <> 'REVERSED' ORDER BY r.number LIMIT ${MAX_ROWS_PER_CHECK}`);
        // Same accounts and amounts with the sides swapped, compared as sorted lists
        const notMirror = await this.rows(
            `SELECT r.id, r.number, o.number AS "originalNumber"
               FROM "JournalEntry" r JOIN "JournalEntry" o ON o.id = r."reversalOfId"
              WHERE (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.a, x.d, x.c), '[]'::jsonb)
                       FROM (SELECT l."ledgerAccountId" AS a, l."debitKobo"::text AS d, l."creditKobo"::text AS c FROM "JournalLine" l WHERE l."journalId" = r.id) x)
                 <> (SELECT COALESCE(jsonb_agg(to_jsonb(y) ORDER BY y.a, y.d, y.c), '[]'::jsonb)
                       FROM (SELECT l."ledgerAccountId" AS a, l."creditKobo"::text AS d, l."debitKobo"::text AS c FROM "JournalLine" l WHERE l."journalId" = o.id) y)
              ORDER BY r.number LIMIT ${MAX_ROWS_PER_CHECK}`);
        return [
            ...missing.map(r => ({ check: "REVERSAL_MISSING" as const, message: `Journal ${r.number} is marked reversed but no reversal exists`, details: { journalId: r.id, number: r.number } })),
            ...unmarked.map(r => ({ check: "REVERSAL_ORIGINAL_NOT_MARKED" as const, message: `Reversal ${r.number} points at ${r.originalNumber}, which is not marked reversed`, details: { journalId: r.id, number: r.number, originalNumber: r.originalNumber } })),
            ...notMirror.map(r => ({ check: "REVERSAL_NOT_MIRROR" as const, message: `Reversal ${r.number} is not the exact opposite of ${r.originalNumber}`, details: { journalId: r.id, number: r.number, originalNumber: r.originalNumber } })),
        ];
    }

    async periodProblems(timeZone: string): Promise<IntegrityFinding[]> {
        const mismatch = await this.rows(
            `SELECT e.id, e.number, e."entryDate" AS date, p.name AS period FROM "JournalEntry" e JOIN "FinancePeriod" p ON p.id = e."periodId"
              WHERE e."entryDate" < p."startDate" OR e."entryDate" > p."endDate" ORDER BY e.number LIMIT ${MAX_ROWS_PER_CHECK}`);
        const future = await this.rows(
            `SELECT e.id, e.number, e."entryDate" AS date FROM "JournalEntry" e
              WHERE e."entryDate" > (e."postedAt" AT TIME ZONE $1)::date ORDER BY e.number LIMIT ${MAX_ROWS_PER_CHECK}`, timeZone);
        // Posted after the period was closed (a reopen in between makes it legitimate, so those are skipped)
        const afterClose = await this.rows(
            `SELECT e.id, e.number, p.name AS period FROM "JournalEntry" e JOIN "FinancePeriod" p ON p.id = e."periodId"
              WHERE p."closedAt" IS NOT NULL AND e."postedAt" > p."closedAt" AND (p."reopenedAt" IS NULL OR p."reopenedAt" < p."closedAt")
                AND p.status = 'CLOSED' ORDER BY e.number LIMIT ${MAX_ROWS_PER_CHECK}`);
        return [
            ...mismatch.map(r => ({ check: "PERIOD_MISMATCH" as const, message: `Journal ${r.number} is dated ${day(r.date)} but filed in period ${r.period}`, details: { journalId: r.id, number: r.number, entryDate: day(r.date), period: r.period } })),
            ...future.map(r => ({ check: "FUTURE_DATED" as const, message: `Journal ${r.number} is dated ${day(r.date)}, after the day it was posted`, details: { journalId: r.id, number: r.number, entryDate: day(r.date) } })),
            ...afterClose.map(r => ({ check: "POSTED_AFTER_CLOSE" as const, message: `Journal ${r.number} was posted into period ${r.period} after it was closed`, details: { journalId: r.id, number: r.number, period: r.period } })),
        ];
    }

    async duplicateOpeningBalances(): Promise<IntegrityFinding[]> {
        const rows = await this.rows(
            `SELECT e."sourceId" AS account, COUNT(*)::int AS n FROM "JournalEntry" e
              WHERE e."sourceType" = 'OPENING_BALANCE' AND e.status = 'POSTED' GROUP BY e."sourceId" HAVING COUNT(*) > 1 LIMIT ${MAX_ROWS_PER_CHECK}`);
        return rows.map(r => ({ check: "DUPLICATE_OPENING_BALANCE" as const, message: `Account ${r.account} has ${r.n} live opening balances`, details: { accountId: r.account, count: r.n } }));
    }

    async linesOnDeletedAccounts(): Promise<IntegrityFinding[]> {
        const rows = await this.rows(
            `SELECT a.id, a.code, a.name, COUNT(l.id)::int AS lines FROM "LedgerAccount" a JOIN "JournalLine" l ON l."ledgerAccountId" = a.id
              WHERE a."deletedAt" IS NOT NULL GROUP BY a.id ORDER BY a.code LIMIT ${MAX_ROWS_PER_CHECK}`);
        return rows.map(r => ({ check: "LINE_ON_DELETED_ACCOUNT" as const, message: `Deleted account ${r.code} ${r.name} has ${r.lines} posting line(s)`, details: { accountId: r.id, code: r.code, lines: r.lines } }));
    }

    /* FEES CONTROLS (brief section 12): the books must agree with the invoices and payments. */
    async feesControls(): Promise<IntegrityFinding[]> {
        const issued = `"status" NOT IN ('draft', 'void')`;
        const [total] = await this.rows(
            `SELECT (SELECT COALESCE(SUM(l."debitKobo") - SUM(l."creditKobo"), 0) FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id = l."ledgerAccountId" WHERE a."systemKey" = 'FEES_RECEIVABLE')::text AS ledger,
                    (SELECT COALESCE(SUM("balanceKobo"), 0) FROM "FeeInvoice" WHERE ${issued})::text AS invoices`);
        const perStudent = await this.rows(
            `SELECT COALESCE(g."partyId", i."studentId") AS student, COALESCE(g.amount, 0)::text AS ledger, COALESCE(i.amount, 0)::text AS invoices
               FROM (SELECT l."partyId", SUM(l."debitKobo") - SUM(l."creditKobo") AS amount FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id = l."ledgerAccountId"
                      WHERE a."systemKey" = 'FEES_RECEIVABLE' AND l."partyType" = 'STUDENT' GROUP BY l."partyId") g
               FULL JOIN (SELECT "studentId", SUM("balanceKobo") AS amount FROM "FeeInvoice" WHERE ${issued} GROUP BY "studentId") i ON i."studentId" = g."partyId"
              WHERE COALESCE(g.amount, 0) <> COALESCE(i.amount, 0) ORDER BY 1 LIMIT ${MAX_ROWS_PER_CHECK}`);
        const [advance] = await this.rows(
            `SELECT (SELECT COALESCE(SUM(l."creditKobo") - SUM(l."debitKobo"), 0) FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id = l."ledgerAccountId" WHERE a."systemKey" = 'ADVANCE_PAYMENTS')::text AS ledger,
                    (SELECT COALESCE(SUM("unallocatedKobo"), 0) FROM "Payment" WHERE status = 'CONFIRMED')::text AS payments`);
        const invoices = await this.rows(
            `SELECT i.id, i."invoiceNumber" AS number, i."paidKobo"::text AS paid, COALESCE(SUM(al."amountKobo"), 0)::text AS allocated
               FROM "FeeInvoice" i LEFT JOIN "PaymentAllocation" al ON al."invoiceId" = i.id AND al."reversedAt" IS NULL
              WHERE i.${issued} GROUP BY i.id HAVING i."paidKobo" <> COALESCE(SUM(al."amountKobo"), 0) ORDER BY i."invoiceNumber" LIMIT ${MAX_ROWS_PER_CHECK}`);
        const credit = await this.rows(
            `SELECT p.id, p."unallocatedKobo"::text AS unallocated, COALESCE(SUM(al."amountKobo"), 0)::text AS credit
               FROM "Payment" p LEFT JOIN "PaymentAllocation" al ON al."paymentId" = p.id AND al."invoiceId" IS NULL AND al."reversedAt" IS NULL
              WHERE p.status = 'CONFIRMED' GROUP BY p.id HAVING p."unallocatedKobo" <> COALESCE(SUM(al."amountKobo"), 0) ORDER BY p.id LIMIT ${MAX_ROWS_PER_CHECK}`);

        const out: IntegrityFinding[] = [];
        if (total.ledger !== total.invoices) out.push({ check: "RECEIVABLE_CONTROL", message: "Fees receivable in the books does not equal what issued invoices still owe", details: { ledgerKobo: total.ledger, invoicesKobo: total.invoices } });
        for (const r of perStudent) out.push({ check: "RECEIVABLE_CONTROL", message: `Student ${r.student}: receivable in the books differs from the invoices`, details: { studentId: r.student, ledgerKobo: r.ledger, invoicesKobo: r.invoices } });
        if (advance.ledger !== advance.payments) out.push({ check: "ADVANCE_CONTROL", message: "Advance payments in the books does not equal the unallocated money on confirmed payments", details: { ledgerKobo: advance.ledger, paymentsKobo: advance.payments } });
        for (const r of invoices) out.push({ check: "INVOICE_PAID_MISMATCH", message: `Invoice ${r.number} shows ${r.paid} paid but its payments add up to ${r.allocated}`, details: { invoiceId: r.id, paidKobo: r.paid, allocatedKobo: r.allocated } });
        for (const r of credit) out.push({ check: "CREDIT_MISMATCH", message: `Payment ${r.id} holds ${r.unallocated} unallocated but its credit adds up to ${r.credit}`, details: { paymentId: r.id, unallocatedKobo: r.unallocated, creditKobo: r.credit } });
        return out;
    }

    /* EXPENSES CONTROLS (brief section 14, rule 6): accounts payable must equal what approved bills still owe. */
    async expensesControls(): Promise<IntegrityFinding[]> {
        const open = `"kind" = 'BILL' AND "status" IN ('APPROVED', 'PARTIALLY_PAID')`;
        const [total] = await this.rows(
            `SELECT (SELECT COALESCE(SUM(l."creditKobo") - SUM(l."debitKobo"), 0) FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id = l."ledgerAccountId" WHERE a."systemKey" = 'ACCOUNTS_PAYABLE')::text AS ledger,
                    (SELECT COALESCE(SUM("totalKobo" - "paidKobo"), 0) FROM "Expense" WHERE ${open})::text AS bills`);
        const perVendor = await this.rows(
            `SELECT COALESCE(g."partyId", b."vendorId") AS vendor, COALESCE(g.amount, 0)::text AS ledger, COALESCE(b.amount, 0)::text AS bills
               FROM (SELECT l."partyId", SUM(l."creditKobo") - SUM(l."debitKobo") AS amount FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id = l."ledgerAccountId"
                      WHERE a."systemKey" = 'ACCOUNTS_PAYABLE' AND l."partyType" = 'VENDOR' GROUP BY l."partyId") g
               FULL JOIN (SELECT "vendorId", SUM("totalKobo" - "paidKobo") AS amount FROM "Expense" WHERE ${open} GROUP BY "vendorId") b ON b."vendorId" = g."partyId"
              WHERE COALESCE(g.amount, 0) <> COALESCE(b.amount, 0) ORDER BY 1 LIMIT ${MAX_ROWS_PER_CHECK}`);
        const paid = await this.rows(
            `SELECT e.id, e."expenseNumber" AS number, e."paidKobo"::text AS paid, COALESCE(SUM(p."amountKobo"), 0)::text AS payments
               FROM "Expense" e LEFT JOIN "ExpensePayment" p ON p."expenseId" = e.id AND p."reversedAt" IS NULL
              WHERE e."status" IN ('APPROVED', 'PARTIALLY_PAID', 'PAID') GROUP BY e.id HAVING e."paidKobo" <> COALESCE(SUM(p."amountKobo"), 0) ORDER BY e."expenseNumber" LIMIT ${MAX_ROWS_PER_CHECK}`);

        const out: IntegrityFinding[] = [];
        if (total.ledger !== total.bills) out.push({ check: "PAYABLE_CONTROL", message: "Accounts payable in the books does not equal what approved bills still owe", details: { ledgerKobo: total.ledger, billsKobo: total.bills } });
        for (const r of perVendor) out.push({ check: "PAYABLE_CONTROL", message: `Supplier ${r.vendor}: payable in the books differs from the bills`, details: { vendorId: r.vendor, ledgerKobo: r.ledger, billsKobo: r.bills } });
        for (const r of paid) out.push({ check: "EXPENSE_PAID_MISMATCH", message: `Expense ${r.number} shows ${r.paid} paid but its payments add up to ${r.payments}`, details: { expenseId: r.id, paidKobo: r.paid, paymentsKobo: r.payments } });
        return out;
    }

    /* PAYROLL CONTROLS: salaries payable must equal what approved, unpaid payslips owe; staff loans receivable must equal what active loans still owe. */
    async payrollControls(): Promise<IntegrityFinding[]> {
        const side = (key: string, sign: string) => `SELECT l."partyId", SUM(${sign}) AS amount FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id = l."ledgerAccountId"
                      WHERE a."systemKey" = '${key}' AND l."partyType" = 'STAFF' GROUP BY l."partyId"`;
        const unpaid = `SELECT "staffId", SUM("netKobo") AS amount FROM "Payslip" WHERE "status" = 'FINAL' GROUP BY "staffId"`;
        const active = `SELECT "staffId", SUM("balanceKobo") AS amount FROM "StaffLoan" WHERE "status" = 'ACTIVE' GROUP BY "staffId"`;
        const [totals] = await this.rows(
            `SELECT (SELECT COALESCE(SUM(l."creditKobo") - SUM(l."debitKobo"), 0) FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id = l."ledgerAccountId" WHERE a."systemKey" = 'SALARIES_PAYABLE')::text AS salaries_ledger,
                    (SELECT COALESCE(SUM("netKobo"), 0) FROM "Payslip" WHERE "status" = 'FINAL')::text AS salaries_slips,
                    (SELECT COALESCE(SUM(l."debitKobo") - SUM(l."creditKobo"), 0) FROM "JournalLine" l JOIN "LedgerAccount" a ON a.id = l."ledgerAccountId" WHERE a."systemKey" = 'STAFF_LOANS_RECEIVABLE')::text AS loans_ledger,
                    (SELECT COALESCE(SUM("balanceKobo"), 0) FROM "StaffLoan" WHERE "status" = 'ACTIVE')::text AS loans_active`);
        const perSalary = await this.rows(
            `SELECT COALESCE(g."partyId", s."staffId") AS staff, COALESCE(g.amount, 0)::text AS ledger, COALESCE(s.amount, 0)::text AS slips
               FROM (${side("SALARIES_PAYABLE", `l."creditKobo" - l."debitKobo"`)}) g FULL JOIN (${unpaid}) s ON s."staffId" = g."partyId"
              WHERE COALESCE(g.amount, 0) <> COALESCE(s.amount, 0) ORDER BY 1 LIMIT ${MAX_ROWS_PER_CHECK}`);
        const perLoan = await this.rows(
            `SELECT COALESCE(g."partyId", s."staffId") AS staff, COALESCE(g.amount, 0)::text AS ledger, COALESCE(s.amount, 0)::text AS loans
               FROM (${side("STAFF_LOANS_RECEIVABLE", `l."debitKobo" - l."creditKobo"`)}) g FULL JOIN (${active}) s ON s."staffId" = g."partyId"
              WHERE COALESCE(g.amount, 0) <> COALESCE(s.amount, 0) ORDER BY 1 LIMIT ${MAX_ROWS_PER_CHECK}`);

        const out: IntegrityFinding[] = [];
        if (totals.salaries_ledger !== totals.salaries_slips) out.push({ check: "PAYROLL_CONTROL", message: "Salaries payable in the books does not equal what approved, unpaid payslips owe", details: { ledgerKobo: totals.salaries_ledger, payslipsKobo: totals.salaries_slips } });
        for (const r of perSalary) out.push({ check: "PAYROLL_CONTROL", message: `Staff ${r.staff}: salaries payable in the books differs from the payslips`, details: { staffId: r.staff, ledgerKobo: r.ledger, payslipsKobo: r.slips } });
        if (totals.loans_ledger !== totals.loans_active) out.push({ check: "LOAN_CONTROL", message: "Staff loans receivable in the books does not equal what active loans still owe", details: { ledgerKobo: totals.loans_ledger, loansKobo: totals.loans_active } });
        for (const r of perLoan) out.push({ check: "LOAN_CONTROL", message: `Staff ${r.staff}: loans receivable in the books differ from the loans`, details: { staffId: r.staff, ledgerKobo: r.ledger, loansKobo: r.loans } });
        return out;
    }

    async systemAccounts(): Promise<SystemAccountRow[]> {
        return this.rows(`SELECT "systemKey", "isActive", "isLocked", "deletedAt" FROM "LedgerAccount" WHERE "systemKey" IS NOT NULL`);
    }
}
