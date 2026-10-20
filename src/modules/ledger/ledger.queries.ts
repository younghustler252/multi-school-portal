import { ledgerErrors } from "./ledger.errors";
import { parseDay } from "./ledger.posting";

/* Reads for the journal list, one journal, and the accounting months. Writes all go through the posting service. */

type Where = Record<string, unknown>;
export interface QueryDb {
    journalEntry: {
        findMany(args: Record<string, unknown>): Promise<any[]>;
        findUnique(args: Record<string, unknown>): Promise<any | null>;
        count(args: { where: Where }): Promise<number>;
    };
    financePeriod: { findMany(args: Record<string, unknown>): Promise<any[]> };
}

export interface JournalFilters { page: number; limit: number; from?: string; to?: string; sourceType?: string; status?: string; accountId?: string }

export class LedgerQueryService {
    constructor(private readonly deps: { db: () => QueryDb }) {}

    async listJournals(f: JournalFilters) {
        const where: Where = {
            ...(f.sourceType && { sourceType: f.sourceType }),
            ...(f.status && { status: f.status }),
            ...((f.from || f.to) && { entryDate: { ...(f.from && { gte: parseDay(f.from) }), ...(f.to && { lte: parseDay(f.to) }) } }),
            ...(f.accountId && { lines: { some: { ledgerAccountId: f.accountId } } }),
        };
        const db = this.deps.db();
        const [rows, total] = await Promise.all([
            db.journalEntry.findMany({ where, orderBy: [{ entryDate: "desc" }, { postedAt: "desc" }, { number: "desc" }], skip: (f.page - 1) * f.limit, take: f.limit }),
            db.journalEntry.count({ where }),
        ]);
        return { rows, total };
    }

    async getJournal(id: string) {
        const row = await this.deps.db().journalEntry.findUnique({
            where: { id },
            include: {
                period: { select: { name: true, status: true } },
                lines: { orderBy: { lineNumber: "asc" }, include: { ledgerAccount: { select: { code: true, name: true } } } },
            },
        });
        if (!row) throw ledgerErrors.journalNotFound();
        return row;
    }

    listPeriods() {
        return this.deps.db().financePeriod.findMany({ orderBy: { startDate: "desc" } });
    }
}
