import { AccountOverview, BankLineEntity, BankStatementEntity, BookLineEntity, MatchGroupEntity, ReconciliationEntity } from "../domain/reconciliation.entity";
import { koboOut } from "../../ledger/mappers/kobo";

const optKobo = (v: bigint | null) => (v === null ? null : koboOut(v));

/* API shapes for bank reconciliation. Money is whole kobo (a number, or a digit string when too large); days are YYYY-MM-DD. */
export class ReconciliationMapper {
    statement(s: BankStatementEntity) {
        return {
            id: s.id, ledgerAccountId: s.ledgerAccountId, fileName: s.fileName, startDate: s.startDate, endDate: s.endDate,
            openingBalanceKobo: optKobo(s.openingBalanceKobo), closingBalanceKobo: optKobo(s.closingBalanceKobo),
            lineCount: s.lineCount, importedAt: s.importedAt.toISOString(),
        };
    }

    bankLine(l: BankLineEntity) {
        return {
            id: l.id, statementId: l.statementId, date: l.date, description: l.description, reference: l.reference,
            amountKobo: koboOut(l.amountKobo), balanceKobo: optKobo(l.balanceKobo), matched: l.matchGroupId !== null, matchGroupId: l.matchGroupId,
        };
    }

    bookLine(l: BookLineEntity) {
        return {
            id: l.id, journalId: l.journalId, journalNumber: l.journalNumber, date: l.date, description: l.description, memo: l.memo,
            sourceType: l.sourceType, isReversal: l.reversalOfJournalId !== null, journalStatus: l.journalStatus,
            amountKobo: koboOut(l.amountKobo), matched: l.matchGroupId !== null, matchGroupId: l.matchGroupId,
        };
    }

    group(g: MatchGroupEntity) {
        return { id: g.id, ledgerAccountId: g.ledgerAccountId, kind: g.kind, note: g.note, createdAt: g.createdAt.toISOString(), bankLineIds: g.bankLineIds, journalLineIds: g.journalLineIds };
    }

    reconciliation(r: ReconciliationEntity) {
        return {
            id: r.id, ledgerAccountId: r.ledgerAccountId, periodId: r.periodId, periodName: r.periodName, periodEnd: r.periodEnd,
            statementBalanceKobo: koboOut(r.statementBalanceKobo), bookBalanceKobo: koboOut(r.bookBalanceKobo), outstandingBookKobo: koboOut(r.outstandingBookKobo),
            note: r.note, completedAt: r.completedAt.toISOString(),
        };
    }

    overview(o: AccountOverview) { return { ...o }; }
}
