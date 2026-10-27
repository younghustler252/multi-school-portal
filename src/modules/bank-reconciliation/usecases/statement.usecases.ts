import { randomUUID } from "crypto";
import { IBankStatementRepository, IReconciliationRepository } from "../repositories/bank-reconciliation.repositories";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { ReconciliationMapper } from "../mappers/reconciliation.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { parseBankCsv, ParsedBankLine, CsvProblem } from "../domain/bank-csv";
import { withDedupeKeys, statementFingerprint } from "../domain/bank-lines";
import { reconciliationErrors } from "../domain/reconciliation.errors";
import { parseDay } from "../../ledger/domain/ledger.dates";
import { koboOut } from "../../ledger/mappers/kobo";
import { ImportStatementDtoType, ListStatementsQueryType } from "../dtos/bank-reconciliation.dto";
import { ReconciliationOptions, assertUnlocked, defaultTransaction, isUniqueViolation, loadBankAccount } from "./reconciliation-shared";

interface Dependencies {
    bankStatementRepository: IBankStatementRepository; reconciliationRepository: IReconciliationRepository;
    ledgerAccountRepository: ILedgerAccountRepository; reconciliationMapper: ReconciliationMapper; auditService: AuditService;
}

export const MAX_STATEMENT_LINES = 5000;

/*
| IMPORT a bank statement for one bank account. Either the CSV text of the bank's export or lines the frontend already read.
|   - A file with unreadable rows is refused (a silently skipped row would make the reconciliation wrong), unless the person
|     confirms with skipUnreadableRows; the unreadable rows are then reported back.
|   - Transactions already imported (an overlapping statement) are skipped, so nothing is ever counted twice.
|   - Nothing can be imported into a month that has already been signed off.
*/
export class ImportStatementUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ReconciliationOptions = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(schoolId: string, actorUserId: string, dto: ImportStatementDtoType) {
        const d = this.d;
        const account = await loadBankAccount(d.ledgerAccountRepository, dto.ledgerAccountId);

        let lines: ParsedBankLine[], problems: CsvProblem[], opening: bigint | null, closing: bigint | null;
        if (dto.csv !== undefined) {
            const parsed = parseBankCsv(dto.csv);
            if (parsed.missingColumns.length) throw reconciliationErrors.statementColumns(parsed.missingColumns);
            ({ lines, problems } = parsed); opening = parsed.openingBalanceKobo; closing = parsed.closingBalanceKobo;
        } else {
            lines = dto.lines!.map((l, i) => ({
                row: i + 1, date: (parseDay(l.date), l.date), description: l.description, reference: l.reference ?? null, amountKobo: l.amountKobo, balanceKobo: l.balanceKobo ?? null,
            }));
            lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row));
            problems = [];
            const first = lines[0], last = lines[lines.length - 1];
            opening = first.balanceKobo !== null ? first.balanceKobo - first.amountKobo : null;
            closing = last.balanceKobo;
        }

        if (lines.length === 0) throw reconciliationErrors.statementEmpty(problems);
        if (problems.length > 0 && !dto.skipUnreadableRows) throw reconciliationErrors.statementProblems(problems);
        if (lines.length > MAX_STATEMENT_LINES) throw reconciliationErrors.statementTooLarge(MAX_STATEMENT_LINES, lines.length);

        const keyed = withDedupeKeys(lines);
        const fileHash = statementFingerprint(keyed.map(l => l.dedupeKey));
        if (await d.bankStatementRepository.findByFileHash(account.id, fileHash)) throw reconciliationErrors.statementDuplicate();

        const existing = await d.bankStatementRepository.existingDedupeKeys(account.id, keyed.map(l => l.dedupeKey));
        const fresh = keyed.filter(l => !existing.has(l.dedupeKey));
        if (fresh.length === 0) throw reconciliationErrors.statementDuplicate();
        await assertUnlocked(d.reconciliationRepository, account.id, fresh.map(l => l.date));

        const id = randomUUID();
        const closingBalanceKobo = dto.closingBalanceKobo ?? closing;
        try {
            await this.transaction(() => d.bankStatementRepository.insert({
                id, ledgerAccountId: account.id, fileName: dto.fileName ?? null, fileHash,
                startDate: fresh[0].date, endDate: fresh[fresh.length - 1].date,
                openingBalanceKobo: opening, closingBalanceKobo, lineCount: fresh.length, importedById: actorUserId,
            }, fresh.map(l => ({
                id: randomUUID(), lineNumber: l.row, date: l.date, description: l.description, reference: l.reference,
                amountKobo: l.amountKobo, balanceKobo: l.balanceKobo, dedupeKey: l.dedupeKey,
            }))));
        } catch (e) {
            if (isUniqueViolation(e)) throw reconciliationErrors.statementDuplicate();   // two uploads raced; the loser stops
            throw e;
        }

        const inKobo = fresh.reduce((s, l) => (l.amountKobo > 0n ? s + l.amountKobo : s), 0n);
        const outKobo = fresh.reduce((s, l) => (l.amountKobo < 0n ? s - l.amountKobo : s), 0n);
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.bank_statement.imported", entity: "BankStatement", entityId: id,
            newValue: { account: account.name, fileName: dto.fileName ?? null, imported: fresh.length, skippedDuplicates: keyed.length - fresh.length, unreadableRows: problems.length, inKobo: inKobo.toString(), outKobo: outKobo.toString() },
        });
        return {
            statement: d.reconciliationMapper.statement((await d.bankStatementRepository.findStatement(id))!),
            imported: fresh.length, skippedDuplicates: keyed.length - fresh.length,
            unreadableRows: problems.slice(0, 20), unreadableRowCount: problems.length,
            totalInKobo: koboOut(inKobo), totalOutKobo: koboOut(outKobo),
        };
    }
}

export class ListStatementsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: ListStatementsQueryType) {
        const r = await this.d.bankStatementRepository.listStatements(q.accountId ?? null, q.page, q.limit);
        return { data: r.rows.map(s => this.d.reconciliationMapper.statement(s)), meta: { page: q.page, limit: q.limit, total: r.total } };
    }
}

/* DELETE a statement imported by mistake. Refused once any of its lines is matched (undo those first) or its dates are signed off. */
export class DeleteStatementUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ReconciliationOptions = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(id: string, schoolId: string, actorUserId: string) {
        const d = this.d;
        const s = await d.bankStatementRepository.findStatement(id);
        if (!s) throw reconciliationErrors.statementNotFound();
        const matched = await d.bankStatementRepository.matchedLineCount(id);
        if (matched > 0) throw reconciliationErrors.statementHasMatches(matched);
        await assertUnlocked(d.reconciliationRepository, s.ledgerAccountId, [s.startDate]);

        await this.transaction(() => d.bankStatementRepository.deleteStatement(id));
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.bank_statement.deleted", entity: "BankStatement", entityId: id,
            oldValue: { fileName: s.fileName, startDate: s.startDate, endDate: s.endDate, lineCount: s.lineCount },
        });
        return { deleted: true };
    }
}
