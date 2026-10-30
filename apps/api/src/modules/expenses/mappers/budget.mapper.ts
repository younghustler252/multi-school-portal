import { IMapper } from "../../../infrastructure/repository/base.repository";
import { koboOut, dayOut } from "../../ledger/mappers/kobo";
import { BudgetEntity, BudgetStatus, RecurrenceFrequency, RecurringEntity, RecurringLine, ExpenseKind } from "../domain/expense.entity";

export interface BudgetRow {
    id: string; name: string; sessionId: string | null; startDate: Date; endDate: Date; status: string; createdById: string; createdAt: Date;
    lines?: { id: string; budgetId: string; ledgerAccountId: string; termId: string | null; plannedKobo: bigint; note: string | null; ledgerAccount?: { code: string; name: string; type: string } | null }[];
}

export class BudgetMapper implements IMapper<BudgetRow, BudgetEntity> {
    toDomain(raw: BudgetRow): BudgetEntity {
        return {
            id: raw.id, name: raw.name, sessionId: raw.sessionId, startDate: raw.startDate, endDate: raw.endDate, status: raw.status as BudgetStatus,
            createdById: raw.createdById, createdAt: raw.createdAt,
            lines: (raw.lines ?? []).map(l => ({
                id: l.id, budgetId: l.budgetId, ledgerAccountId: l.ledgerAccountId, accountCode: l.ledgerAccount?.code ?? null, accountName: l.ledgerAccount?.name ?? null,
                accountType: l.ledgerAccount?.type ?? null, termId: l.termId, plannedKobo: l.plannedKobo, note: l.note,
            })).sort((a, b) => (a.accountCode ?? "").localeCompare(b.accountCode ?? "")),
        };
    }

    toResponse(e: BudgetEntity) {
        return {
            id: e.id, name: e.name, sessionId: e.sessionId, startDate: dayOut(e.startDate), endDate: dayOut(e.endDate), status: e.status, createdById: e.createdById,
            createdAt: e.createdAt, totalPlannedKobo: koboOut(e.lines.reduce((s, l) => s + l.plannedKobo, 0n)),
            lines: e.lines.map(l => ({ id: l.id, ledgerAccountId: l.ledgerAccountId, accountCode: l.accountCode, accountName: l.accountName, accountType: l.accountType, termId: l.termId, plannedKobo: koboOut(l.plannedKobo), note: l.note })),
        };
    }
}

export interface RecurringRow {
    id: string; vendorId: string | null; kind: string; payFromAccountId: string | null; description: string; lines: unknown; frequency: string;
    startDate: Date; endDate: Date | null; nextRunDate: Date; lastRunAt: Date | null; autoApprove: boolean; isActive: boolean; createdById: string; createdAt: Date;
    vendor?: { name: string } | null;
}

/* The saved lines hold kobo as digit strings (JSON has no BigInt). */
export const linesToJson = (lines: RecurringLine[]) => lines.map(l => ({ ledgerAccountId: l.ledgerAccountId, description: l.description, amountKobo: l.amountKobo.toString() }));

export class RecurringMapper implements IMapper<RecurringRow, RecurringEntity> {
    toDomain(raw: RecurringRow): RecurringEntity {
        const stored = (Array.isArray(raw.lines) ? raw.lines : []) as { ledgerAccountId: string; description: string; amountKobo: string }[];
        return {
            id: raw.id, vendorId: raw.vendorId, vendorName: raw.vendor?.name ?? null, kind: raw.kind as ExpenseKind, payFromAccountId: raw.payFromAccountId,
            description: raw.description, lines: stored.map(l => ({ ledgerAccountId: l.ledgerAccountId, description: l.description, amountKobo: BigInt(l.amountKobo) })),
            frequency: raw.frequency as RecurrenceFrequency, startDate: raw.startDate, endDate: raw.endDate, nextRunDate: raw.nextRunDate, lastRunAt: raw.lastRunAt,
            autoApprove: raw.autoApprove, isActive: raw.isActive, createdById: raw.createdById, createdAt: raw.createdAt,
        };
    }

    toResponse(e: RecurringEntity) {
        return {
            id: e.id, vendor: e.vendorId ? { id: e.vendorId, name: e.vendorName } : null, kind: e.kind, payFromAccountId: e.payFromAccountId, description: e.description,
            lines: e.lines.map(l => ({ ledgerAccountId: l.ledgerAccountId, description: l.description, amountKobo: koboOut(l.amountKobo) })),
            totalKobo: koboOut(e.lines.reduce((s, l) => s + l.amountKobo, 0n)), frequency: e.frequency, startDate: dayOut(e.startDate),
            endDate: e.endDate ? dayOut(e.endDate) : null, nextRunDate: dayOut(e.nextRunDate), lastRunAt: e.lastRunAt, autoApprove: e.autoApprove,
            isActive: e.isActive, createdById: e.createdById, createdAt: e.createdAt,
        };
    }
}
