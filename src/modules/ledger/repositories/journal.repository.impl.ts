import { BaseTenantRepository, PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { JournalMapper } from "../mappers/journal.mapper";
import { JournalEntity, JournalFilters, JournalStatus, NewJournal } from "../domain/ledger.entity";
import { IJournalRepository } from "./journal.repository";
import { parseDay } from "../domain/ledger.dates";

export class JournalRepositoryImpl extends BaseTenantRepository<JournalEntity> implements IJournalRepository {
    protected readonly modelName = "journalEntry";       // no soft delete: a posted journal is never removed

    constructor({ journalMapper }: { journalMapper: JournalMapper }) { super(journalMapper); }

    findByIdempotencyKey(key: string): Promise<JournalEntity | null> { return this.findOne({ idempotencyKey: key }); }

    findDetail(id: string): Promise<JournalEntity | null> {
        return this.findById(id, {
            period: { select: { name: true, status: true } },
            lines: { orderBy: { lineNumber: "asc" }, include: { ledgerAccount: { select: { code: true, name: true } } } },
        });
    }

    listFiltered(f: JournalFilters): Promise<PaginatedResult<JournalEntity>> {
        const where: Record<string, unknown> = {
            ...(f.sourceType && { sourceType: f.sourceType }),
            ...(f.status && { status: f.status }),
            ...((f.from || f.to) && { entryDate: { ...(f.from && { gte: parseDay(f.from) }), ...(f.to && { lte: parseDay(f.to) }) } }),
            ...(f.accountId && { lines: { some: { ledgerAccountId: f.accountId } } }),
        };
        return this.paginate({
            page: f.page, limit: f.limit, where,
            orderBy: [{ entryDate: "desc" }, { postedAt: "desc" }, { number: "desc" }] as never,
        });
    }

    async statusesBySource(sourceType: string, sourceId: string): Promise<JournalStatus[]> {
        const rows = await this.model().findMany({ where: { sourceType, sourceId }, select: { status: true } });
        return rows.map((r: { status: JournalStatus }) => r.status);
    }

    saveWithLines(j: NewJournal): Promise<JournalEntity> {
        const { lines, ...header } = j;
        return this.create(
            { ...header, lines: { create: lines } },
            { lines: { orderBy: { lineNumber: "asc" } } },
        );
    }

    async markReversed(id: string): Promise<void> { await this.update(id, { status: "REVERSED" }); }
}
