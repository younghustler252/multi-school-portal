import { randomUUID } from "crypto";
import { IBankStatementRepository, IBookLineRepository, IReconciliationRepository } from "../repositories/bank-reconciliation.repositories";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { IFinancePeriodRepository } from "../../ledger/repositories/finance-period.repository";
import { FinancePeriodEntity } from "../../ledger/domain/ledger.entity";
import { ReconciliationMapper } from "../mappers/reconciliation.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { dropReversalPairs } from "../domain/matching";
import { ReconciliationSummary, statementBalanceAt, summarise } from "../domain/reconciliation-math";
import { reconciliationErrors } from "../domain/reconciliation.errors";
import { ledgerErrors } from "../../ledger/domain/ledger.errors";
import { dayString, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { koboOut } from "../../ledger/mappers/kobo";
import { CompleteReconciliationDtoType, ReopenReconciliationDtoType } from "../dtos/bank-reconciliation.dto";
import { ReconciliationOptions, defaultTransaction, isUniqueViolation, loadBankAccount } from "./reconciliation-shared";

interface Dependencies {
    bankStatementRepository: IBankStatementRepository; bookLineRepository: IBookLineRepository; reconciliationRepository: IReconciliationRepository;
    ledgerAccountRepository: ILedgerAccountRepository; financePeriodRepository: IFinancePeriodRepository;
    reconciliationMapper: ReconciliationMapper; auditService: AuditService;
}

const SAMPLE = 100;   // how many open items a summary lists; the counts and totals always cover all of them

async function loadPeriod(d: Dependencies, id: string): Promise<FinancePeriodEntity> {
    const p = await d.financePeriodRepository.findById(id);
    if (!p) throw ledgerErrors.periodNotFound();
    return p;
}

/* Everything the month-end screen and the sign-off need, worked out from the books and the bank lines as at the month's last day. */
async function position(d: Dependencies, accountId: string, asOf: string, typedBalance: bigint | null | undefined) {
    const bookBalanceKobo = await d.bookLineRepository.balanceAsOf(accountId, asOf);
    const outstanding = dropReversalPairs(await d.bookLineRepository.unmatchedUpTo(accountId, asOf));
    const unmatchedBank = await d.bankStatementRepository.unmatchedUpTo(accountId, asOf);

    const statementBalanceKobo = typedBalance ?? statementBalanceAt(await d.bankStatementRepository.balancesUpTo(accountId, asOf), asOf);
    const outstandingBookKobo = outstanding.reduce((s, l) => s + l.amountKobo, 0n);
    const unmatchedBankKobo = unmatchedBank.reduce((s, l) => s + l.amountKobo, 0n);
    const summary: ReconciliationSummary | null = statementBalanceKobo === null ? null : summarise({
        statementBalanceKobo, bookBalanceKobo, outstandingBookKobo, unmatchedBankKobo, unmatchedBankCount: unmatchedBank.length,
    });
    return { bookBalanceKobo, outstanding, unmatchedBank, statementBalanceKobo, outstandingBookKobo, unmatchedBankKobo, summary };
}

/*
| THE RECONCILIATION STATEMENT for one bank account and one accounting month (read only).
| Shows what the bank says, what the books say, the entries the bank has not shown yet (outstanding), the bank lines the books do not have
| (to record or match), and whether the two sides agree. Pass the bank's closing balance when the statement has no running balance.
*/
export class ReconciliationSummaryUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(accountId: string, periodId: string, typedBalance?: bigint) {
        const d = this.d, m = d.reconciliationMapper;
        const account = await loadBankAccount(d.ledgerAccountRepository, accountId);
        const period = await loadPeriod(d, periodId);
        const asOf = dayString(period.endDate);
        const p = await position(d, accountId, asOf, typedBalance);
        const done = await d.reconciliationRepository.find(accountId, periodId);

        return {
            account: { id: account.id, name: account.name, bankName: account.bankName, accountNumberLast4: account.accountNumberLast4 },
            period: { id: period.id, name: period.name, endDate: asOf },
            reconciliation: done ? m.reconciliation(done) : null,
            needsStatementBalance: p.statementBalanceKobo === null,
            statementBalanceKobo: p.statementBalanceKobo === null ? null : koboOut(p.statementBalanceKobo),
            bookBalanceKobo: koboOut(p.bookBalanceKobo),
            outstandingBook: { count: p.outstanding.length, netKobo: koboOut(p.outstandingBookKobo), items: p.outstanding.slice(0, SAMPLE).map(l => m.bookLine(l)) },
            unmatchedBank: { count: p.unmatchedBank.length, netKobo: koboOut(p.unmatchedBankKobo), items: p.unmatchedBank.slice(0, SAMPLE).map(l => m.bankLine(l)) },
            adjustedBankKobo: p.summary ? koboOut(p.summary.adjustedBankKobo) : null,
            adjustedBookKobo: p.summary ? koboOut(p.summary.adjustedBookKobo) : null,
            differenceKobo: p.summary ? koboOut(p.summary.differenceKobo) : null,
            canComplete: !done && !!p.summary && p.summary.canComplete,
        };
    }
}

/*
| COMPLETE a month for a bank account. The month must have ended; the bank balance must be known (from the file or typed in);
| every bank line up to the month end must be matched or recorded; and the adjusted balances must agree to the kobo.
| After this, everything dated up to the month end is locked for this account (see assertUnlocked) and the close checklist stops warning.
*/
export class CompleteReconciliationUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ReconciliationOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(schoolId: string, actorUserId: string, dto: CompleteReconciliationDtoType) {
        const d = this.d;
        const account = await loadBankAccount(d.ledgerAccountRepository, dto.ledgerAccountId);
        const period = await loadPeriod(d, dto.periodId);
        const asOf = dayString(period.endDate), today = todayInFinanceZone(this.now());
        if (asOf >= today) throw reconciliationErrors.periodNotEnded(period.name, asOf, today);
        if (await d.reconciliationRepository.find(account.id, period.id)) throw reconciliationErrors.alreadyReconciled(period.name);

        const p = await position(d, account.id, asOf, dto.statementBalanceKobo);
        if (!p.summary) throw reconciliationErrors.statementBalanceRequired(asOf);
        if (p.unmatchedBank.length > 0) throw reconciliationErrors.unmatchedBankLines(p.unmatchedBank.length, p.unmatchedBankKobo);
        if (p.summary.differenceKobo !== 0n) throw reconciliationErrors.notAgreed(p.summary.differenceKobo, p.summary.adjustedBankKobo, p.summary.adjustedBookKobo);

        const id = randomUUID();
        try {
            await this.transaction(() => d.reconciliationRepository.create({
                id, ledgerAccountId: account.id, periodId: period.id, statementBalanceKobo: p.summary!.statementBalanceKobo,
                bookBalanceKobo: p.bookBalanceKobo, outstandingBookKobo: p.outstandingBookKobo, note: dto.note ?? null, completedById: actorUserId,
            }));
        } catch (e) {
            if (isUniqueViolation(e)) throw reconciliationErrors.alreadyReconciled(period.name);   // two people signed off at once
            throw e;
        }
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.bank_reconciliation.completed", entity: "BankReconciliation", entityId: id,
            newValue: {
                account: account.name, period: period.name, statementBalanceKobo: p.summary.statementBalanceKobo.toString(),
                bookBalanceKobo: p.bookBalanceKobo.toString(), outstandingItems: p.outstanding.length, outstandingBookKobo: p.outstandingBookKobo.toString(), note: dto.note ?? null,
            },
        });
        return d.reconciliationMapper.reconciliation((await d.reconciliationRepository.findById(id))!);
    }
}

/* REOPEN a signed-off month, with a written reason. Only the latest month of an account can be reopened, so the locks always run unbroken up to a date. */
export class ReopenReconciliationUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ReconciliationOptions = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(id: string, schoolId: string, actorUserId: string, dto: ReopenReconciliationDtoType) {
        const d = this.d;
        const reason = dto.reason.trim();
        if (!reason) throw reconciliationErrors.reasonRequired();
        const r = await d.reconciliationRepository.findById(id);
        if (!r) throw reconciliationErrors.reconciliationNotFound();
        const latest = await d.reconciliationRepository.latest(r.ledgerAccountId);
        if (latest && latest.id !== r.id) throw reconciliationErrors.onlyLatestReopens(latest.periodName);

        await this.transaction(() => d.reconciliationRepository.delete(id));
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.bank_reconciliation.reopened", entity: "BankReconciliation", entityId: id,
            oldValue: { period: r.periodName, statementBalanceKobo: r.statementBalanceKobo.toString() }, newValue: { reason },
        });
        return { reopened: true, period: r.periodName };
    }
}

export class ListReconciliationsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(accountId?: string) {
        const rows = await this.d.reconciliationRepository.list(accountId ?? null);
        return { data: rows.map(r => this.d.reconciliationMapper.reconciliation(r)) };
    }
}

/* The bank accounts with how far each has got: lines imported, lines still unmatched, and the month it was last signed off through. */
export class AccountsOverviewUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute() {
        return { accounts: (await this.d.reconciliationRepository.overview()).map(o => this.d.reconciliationMapper.overview(o)) };
    }
}
