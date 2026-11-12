import type { Access } from "../../../foundation/access.service";
import { ForbiddenError } from "../../../shared/errors/domain.errors";
import { AuditService } from "../../audit/services/audit.service";
import { IEventTypeRepository } from "../repositories/event-type.repository";
import { EventTypeMapper, EventTypeResponseData } from "../mappers/event-type.mapper";
import { eventTypeErrors } from "../domain/event-type.errors";
import { assertCanCreateCustom, assertCanDelete, assertChangeAllowed, cleanName, keyCandidate, nameKeyOf, slugOf } from "../domain/event-type.policy";
import type { CreateEventTypeDtoType, ListEventTypesQueryType, UpdateEventTypeDtoType } from "../dtos/event-type.dto";

export const MANAGE_TYPES = "events.types.manage";
export interface EventTypeActor { userId: string }

/* Runs `fn` as one database transaction. The default is the repository's (use cases never touch the database client); tests pass a plain pass-through. */
export type RunInTransaction = <T>(fn: () => Promise<T>) => Promise<T>;

interface Deps { eventTypeRepository: IEventTypeRepository; eventTypeMapper: EventTypeMapper; auditService: AuditService; runInTransaction?: RunInTransaction }

const KEY_ATTEMPTS = 50;

/* LIST. Everyone signed in sees the ACTIVE types (they fill the event form and the calendar legend). Inactive ones are for the manager only. */
export class ListEventTypesUseCase {
    constructor(private readonly d: Deps) {}
    async execute(q: ListEventTypesQueryType, access?: Access): Promise<EventTypeResponseData[]> {
        if (q.includeInactive && !access?.can(MANAGE_TYPES)) throw new ForbiddenError("You do not have permission to see inactive event types");
        return (await this.d.eventTypeRepository.findAll(q.includeInactive)).map(t => this.d.eventTypeMapper.toResponse(t));
    }
}

/* CREATE. The count, the key choice and the insert happen in ONE transaction behind a per-school lock, so two admins creating at the same moment cannot both take the last slot. */
export class CreateEventTypeUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, dto: CreateEventTypeDtoType, actor: EventTypeActor): Promise<EventTypeResponseData> {
        const { eventTypeRepository: repo } = this.d;
        const run: RunInTransaction = this.d.runInTransaction ?? (fn => repo.transaction(fn));
        const name = cleanName(dto.name);
        const created = await run(async () => {
            await repo.lockForCreate();
            assertCanCreateCustom(await repo.countCustom());
            const base = slugOf(name);
            let key: string | null = null;
            for (let i = 0; i < KEY_ATTEMPTS && !key; i++) { const k = keyCandidate(base, i); if (!(await repo.findByKey(k))) key = k; }
            if (!key) throw eventTypeErrors.nameTaken();
            return repo.create({ key, name, nameKey: nameKeyOf(name), color: dto.color ?? null, icon: dto.icon ?? null, createdById: actor.userId });
        });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "event_type.created", entity: "CalendarEventType", entityId: created.id, newValue: { key: created.key, name: created.name, color: created.color, icon: created.icon } });
        return this.d.eventTypeMapper.toResponse(created);
    }
}

/* UPDATE. Custom types: rename, recolour, change icon, deactivate and reactivate. System types: colour and icon only. The key never changes. */
export class UpdateEventTypeUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, dto: UpdateEventTypeDtoType, actor: EventTypeActor): Promise<EventTypeResponseData> {
        const { eventTypeRepository: repo } = this.d;
        const type = await repo.findById(id);
        if (!type) throw eventTypeErrors.notFound();
        assertChangeAllowed(type, dto);

        const changes: Record<string, unknown> = {};
        if (dto.name !== undefined && cleanName(dto.name) !== type.name) { changes.name = cleanName(dto.name); changes.nameKey = nameKeyOf(dto.name); }
        if (dto.color !== undefined && dto.color !== type.color) changes.color = dto.color;
        if (dto.icon !== undefined && dto.icon !== type.icon) changes.icon = dto.icon;
        if (dto.isActive !== undefined && dto.isActive !== type.isActive) changes.isActive = dto.isActive;
        if (Object.keys(changes).length === 0) return this.d.eventTypeMapper.toResponse(type);       // nothing to do: not an error, not an audit entry

        const updated = await repo.update(id, changes);
        const { isActive, ...rest } = changes;
        const before = { name: type.name, color: type.color, icon: type.icon, isActive: type.isActive };
        const after = { name: updated.name, color: updated.color, icon: updated.icon, isActive: updated.isActive };
        if (Object.keys(rest).length) await this.d.auditService.log({ userId: actor.userId, schoolId, action: "event_type.updated", entity: "CalendarEventType", entityId: id, oldValue: before, newValue: after });
        if (isActive !== undefined) await this.d.auditService.log({ userId: actor.userId, schoolId, action: isActive ? "event_type.activated" : "event_type.deactivated", entity: "CalendarEventType", entityId: id, oldValue: before, newValue: after });
        return this.d.eventTypeMapper.toResponse(updated);
    }
}

/* DELETE. Only a custom type that no event uses. A used one is deactivated instead, so old events keep their label. The database (RESTRICT) backs this up against a race. */
export class DeleteEventTypeUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, actor: EventTypeActor): Promise<{ id: string }> {
        const { eventTypeRepository: repo } = this.d;
        const type = await repo.findById(id);
        if (!type) throw eventTypeErrors.notFound();
        assertCanDelete(type, type.isSystem ? 0 : await repo.countEventsUsing(id));
        await repo.remove(id);
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "event_type.deleted", entity: "CalendarEventType", entityId: id, oldValue: { key: type.key, name: type.name } });
        return { id };
    }
}
