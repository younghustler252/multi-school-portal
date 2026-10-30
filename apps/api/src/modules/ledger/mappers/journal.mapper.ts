import type { JournalEntry, JournalLine } from "../../../generated/tenant";
import { IMapper } from "../../../infrastructure/repository/base.repository";
import { JournalEntity, JournalLineEntity, JournalSource, PartyType, JournalStatus, PeriodStatus } from "../domain/ledger.entity";
import { koboOut, dayOut } from "./kobo";

type RawLine = JournalLine & { ledgerAccount?: { code: string; name: string } | null };
type RawJournal = JournalEntry & { period?: { name: string; status: string } | null; lines?: RawLine[] };

export interface JournalSummaryResponse {
    id: string; number: string; entryDate: string; description: string; sourceType: string; sourceId: string | null; purpose: string;
    status: string; totalKobo: number | string; reversalOfId: string | null; reversalReason: string | null;
    branchId: string | null; termId: string | null; sessionId: string | null; createdById: string | null; isSystemActor: boolean; postedAt: Date;
}
export interface JournalDetailResponse extends JournalSummaryResponse {
    period: { name: string; status: string } | null;
    lines: Array<{
        lineNumber: number; accountId: string; accountCode: string | null; accountName: string | null;
        debitKobo: number | string; creditKobo: number | string; partyType: string | null; partyId: string | null; memo: string | null;
    }>;
}

export class JournalMapper implements IMapper<RawJournal, JournalEntity> {
    toDomain(raw: RawJournal): JournalEntity {
        return {
            id: raw.id, number: raw.number, entryDate: raw.entryDate, periodId: raw.periodId,
            termId: raw.termId, sessionId: raw.sessionId, branchId: raw.branchId,
            description: raw.description, sourceType: raw.sourceType as JournalSource, sourceId: raw.sourceId,
            purpose: raw.purpose, idempotencyKey: raw.idempotencyKey, status: raw.status as JournalStatus,
            reversalOfId: raw.reversalOfId, reversalReason: raw.reversalReason, totalKobo: raw.totalKobo,
            createdById: raw.createdById, isSystemActor: raw.isSystemActor, postedAt: raw.postedAt,
            period: raw.period ? { name: raw.period.name, status: raw.period.status as PeriodStatus } : null,
            lines: (raw.lines ?? []).map((l): JournalLineEntity => ({
                id: l.id, lineNumber: l.lineNumber, accountId: l.ledgerAccountId,
                accountCode: l.ledgerAccount?.code ?? null, accountName: l.ledgerAccount?.name ?? null,
                debitKobo: l.debitKobo, creditKobo: l.creditKobo,
                partyType: (l.partyType as PartyType | null) ?? null, partyId: l.partyId, memo: l.memo,
            })),
        };
    }

    toSummary(e: JournalEntity): JournalSummaryResponse {
        return {
            id: e.id, number: e.number, entryDate: dayOut(e.entryDate), description: e.description,
            sourceType: e.sourceType, sourceId: e.sourceId, purpose: e.purpose, status: e.status,
            totalKobo: koboOut(e.totalKobo), reversalOfId: e.reversalOfId, reversalReason: e.reversalReason,
            branchId: e.branchId, termId: e.termId, sessionId: e.sessionId,
            createdById: e.createdById, isSystemActor: e.isSystemActor, postedAt: e.postedAt,
        };
    }

    toDetail(e: JournalEntity): JournalDetailResponse {
        return {
            ...this.toSummary(e),
            period: e.period ? { name: e.period.name, status: e.period.status } : null,
            lines: e.lines.map(l => ({
                lineNumber: l.lineNumber, accountId: l.accountId, accountCode: l.accountCode, accountName: l.accountName,
                debitKobo: koboOut(l.debitKobo), creditKobo: koboOut(l.creditKobo),
                partyType: l.partyType, partyId: l.partyId, memo: l.memo,
            })),
        };
    }
}
