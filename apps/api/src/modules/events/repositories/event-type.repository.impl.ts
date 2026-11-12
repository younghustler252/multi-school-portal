import { withTenantTransaction } from "../../../infrastructure/database/prisma/prisma.client";
import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import type { EventTypeEntity } from "../domain/event-type.entity";
import { eventTypeErrors } from "../domain/event-type.errors";
import { EventTypeMapper } from "../mappers/event-type.mapper";
import { EventTypeChanges, IEventTypeRepository, NewEventType } from "./event-type.repository";

/* Maps what the database says into the module's errors, so the API answers with stable codes and never leaks SQL. */
const text = (e: unknown): string => `${(e as { message?: string })?.message ?? ""} ${JSON.stringify((e as { meta?: unknown })?.meta ?? {})}`;
const isUnique = (e: unknown, field: string): boolean => (e as { code?: string })?.code === "P2002" && text(e).includes(field);
const isProtected = (e: unknown): boolean => text(e).includes("EVENT_TYPE_PROTECTED");
const isStillReferenced = (e: unknown): boolean => (e as { code?: string })?.code === "P2003" || /foreign key/i.test(text(e));

export class EventTypeRepositoryImpl extends BaseTenantRepository<EventTypeEntity> implements IEventTypeRepository {
    protected readonly modelName = "calendarEventType";

    constructor({ eventTypeMapper }: { eventTypeMapper: EventTypeMapper }) { super(eventTypeMapper); }

    transaction<T>(fn: () => Promise<T>): Promise<T> { return withTenantTransaction(async () => fn()); }

    async findAll(includeInactive: boolean): Promise<EventTypeEntity[]> {
        const rows = await this.model().findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }, { name: "asc" }] });
        return this.mapMany(rows);
    }
    override async findById(id: string): Promise<EventTypeEntity | null> { return this.mapOne(await this.model().findUnique({ where: { id } })); }
    async findByKey(key: string): Promise<EventTypeEntity | null> { return this.mapOne(await this.model().findUnique({ where: { key } })); }
    async countCustom(): Promise<number> { return this.model().count({ where: { isSystem: false } }); }

    async lockForCreate(): Promise<void> {
        // One lock per school: the tenant schema name is part of the key. Released automatically when the transaction ends.
        await this.prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('evtypes:' || current_schema()))`;
    }

    async create(data: NewEventType): Promise<EventTypeEntity> {
        try {
            return this.mapper.toDomain(await this.model().create({ data: { ...data, isSystem: false, isActive: true } }));
        } catch (e) {
            if (isUnique(e, "nameKey")) throw eventTypeErrors.nameTaken();
            throw e;
        }
    }

    async update(id: string, changes: EventTypeChanges): Promise<EventTypeEntity> {
        try {
            return this.mapper.toDomain(await this.model().update({ where: { id }, data: changes }));
        } catch (e) {
            if (isUnique(e, "nameKey")) throw eventTypeErrors.nameTaken();
            if (isProtected(e)) throw eventTypeErrors.protected();
            throw e;
        }
    }

    async countEventsUsing(id: string): Promise<number> { return this.prisma.calendarEvent.count({ where: { eventTypeId: id } }); }

    async remove(id: string): Promise<void> {
        try { await this.model().delete({ where: { id } }); }
        catch (e) {
            if (isProtected(e)) throw eventTypeErrors.protected();
            if (isStillReferenced(e)) throw eventTypeErrors.inUse(await this.countEventsUsing(id));
            throw e;
        }
    }
}
