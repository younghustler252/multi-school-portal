import { IMapper } from "../../../infrastructure/repository/base.repository";
import type { EventTypeEntity, EventTypeRef } from "../domain/event-type.entity";

export interface EventTypeResponseData extends EventTypeRef { createdAt: Date; updatedAt: Date }

export class EventTypeMapper implements IMapper<any, EventTypeEntity> {
    toDomain(raw: any): EventTypeEntity {
        return {
            id: raw.id, key: raw.key, name: raw.name, nameKey: raw.nameKey, color: raw.color ?? null, icon: raw.icon ?? null,
            isSystem: !!raw.isSystem, isActive: raw.isActive !== false, createdById: raw.createdById ?? null, createdAt: raw.createdAt, updatedAt: raw.updatedAt,
        };
    }
    toRef(t: EventTypeEntity): EventTypeRef { return { id: t.id, key: t.key, name: t.name, color: t.color, icon: t.icon, isSystem: t.isSystem, isActive: t.isActive }; }
    toResponse(t: EventTypeEntity): EventTypeResponseData { return { ...this.toRef(t), createdAt: t.createdAt, updatedAt: t.updatedAt }; }
}
