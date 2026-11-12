import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { CalendarEventEntity } from "../domain/event.entity";
import { EventMapper } from "../mappers/event.mapper";
import { EventWrite, IEventRepository, PlannedReminder, ReminderRow } from "./event.repository";

const WITH_AUDIENCE = { branches: true, classes: true } as const;

export class EventRepositoryImpl extends BaseTenantRepository<CalendarEventEntity> implements IEventRepository {
    protected readonly modelName = "calendarEvent";

    constructor({ eventMapper }: { eventMapper: EventMapper }) { super(eventMapper); }

    private audienceWrites({ branchIds, classIds }: EventWrite, replacing: boolean): Record<string, any> {
        const out: Record<string, any> = {};
        if (branchIds) out.branches = replacing ? { deleteMany: {}, create: branchIds.map(branchId => ({ branchId })) } : { create: branchIds.map(branchId => ({ branchId })) };
        if (classIds)  out.classes  = replacing ? { deleteMany: {}, create: classIds.map(classId => ({ classId })) }    : { create: classIds.map(classId => ({ classId })) };
        return out;
    }

    async create(write: EventWrite): Promise<CalendarEventEntity> {
        const raw = await this.model().create({ data: { ...write.data, ...this.audienceWrites(write, false) }, include: WITH_AUDIENCE });
        return this.mapper.toDomain(raw);
    }

    override async findById(id: string): Promise<CalendarEventEntity | null> {
        return this.mapOne(await this.model().findUnique({ where: { id }, include: WITH_AUDIENCE }));
    }

    async findMany(where: Record<string, any>): Promise<CalendarEventEntity[]> {
        return this.mapMany(await this.model().findMany({ where, include: WITH_AUDIENCE, orderBy: [{ startDate: "asc" }, { startTime: "asc" }, { createdAt: "asc" }] }));
    }

    async update(id: string, write: EventWrite): Promise<CalendarEventEntity> {
        const raw = await this.model().update({ where: { id }, data: { ...write.data, ...this.audienceWrites(write, true) }, include: WITH_AUDIENCE });
        return this.mapper.toDomain(raw);
    }

    async deleteDraft(id: string): Promise<void> {
        await this.model().delete({ where: { id } });    // its audience rows go with it (ON DELETE CASCADE)
    }

    private reminders(): any { return (this.prisma as any).calendarEventReminder; }
    private toReminder = (r: any): ReminderRow => ({ id: r.id, eventId: r.eventId, revision: r.revision, offsetMinutes: r.offsetMinutes, dueAt: r.dueAt, status: r.status, attempts: r.attempts });

    async syncReminders(eventId: string, planned: PlannedReminder[]): Promise<void> {
        const wanted = new Set(planned.map(p => `${p.revision}:${p.offsetMinutes}`));
        const existing = await this.reminders().findMany({ where: { eventId } });
        const have = new Set<string>(existing.map((r: any) => `${r.revision}:${r.offsetMinutes}`));
        const drop = existing.filter((r: any) => r.status === "PENDING" && !wanted.has(`${r.revision}:${r.offsetMinutes}`)).map((r: any) => r.id);
        if (drop.length) await this.reminders().updateMany({ where: { id: { in: drop }, status: "PENDING" }, data: { status: "CANCELLED", processedAt: new Date() } });
        // An offset that was removed and then added back brings its cancelled row back to life (rows are unique per revision and offset)
        for (const r of existing.filter((x: any) => x.status === "CANCELLED")) {
            const again = planned.find(p => p.revision === r.revision && p.offsetMinutes === r.offsetMinutes && p.status === "PENDING");
            if (again) await this.reminders().update({ where: { id: r.id }, data: { status: "PENDING", dueAt: again.dueAt, lastError: null, processedAt: null, attempts: 0 } });
        }
        const fresh = planned.filter(p => !have.has(`${p.revision}:${p.offsetMinutes}`));
        if (fresh.length) await this.reminders().createMany({ data: fresh.map(p => ({ eventId, revision: p.revision, offsetMinutes: p.offsetMinutes, dueAt: p.dueAt, status: p.status, lastError: p.lastError, processedAt: p.status === "SKIPPED" ? new Date() : null })), skipDuplicates: true });
    }

    async cancelPendingReminders(eventId: string): Promise<void> {
        await this.reminders().updateMany({ where: { eventId, status: "PENDING" }, data: { status: "CANCELLED", processedAt: new Date() } });
    }

    async recoverStaleReminders(before: Date): Promise<number> {
        const r = await this.reminders().updateMany({ where: { status: "PROCESSING", updatedAt: { lt: before } }, data: { status: "PENDING" } });
        return r.count;
    }

    async claimDueReminders(now: Date, limit: number): Promise<ReminderRow[]> {
        const due = await this.reminders().findMany({ where: { status: "PENDING", dueAt: { lte: now } }, orderBy: { dueAt: "asc" }, take: limit });
        const claimed: ReminderRow[] = [];
        for (const r of due) {
            // Only one caller wins the PENDING → PROCESSING step for a row
            const won = await this.reminders().updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
            if (won.count === 1) claimed.push(this.toReminder({ ...r, status: "PROCESSING", attempts: r.attempts + 1 }));
        }
        return claimed;
    }

    async finishReminder(id: string, status: "SENT" | "SKIPPED" | "CANCELLED" | "FAILED" | "PENDING", note: string | null = null): Promise<void> {
        await this.reminders().update({ where: { id }, data: { status, lastError: note, processedAt: status === "PENDING" ? null : new Date() } });
    }

    async listReminders(eventId: string): Promise<ReminderRow[]> {
        return (await this.reminders().findMany({ where: { eventId }, orderBy: [{ revision: "asc" }, { dueAt: "asc" }] })).map(this.toReminder);
    }
}
