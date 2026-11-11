import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { CalendarEventEntity } from "../domain/event.entity";
import { EventMapper } from "../mappers/event.mapper";
import { EventWrite, IEventRepository } from "./event.repository";

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
}
