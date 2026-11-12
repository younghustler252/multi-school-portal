import type { EventTypeEntity } from "../domain/event-type.entity";

export interface NewEventType { key: string; name: string; nameKey: string; color: string | null; icon: string | null; createdById: string }
export interface EventTypeChanges { name?: string; nameKey?: string; color?: string | null; icon?: string | null; isActive?: boolean }

export interface IEventTypeRepository {
    /** System types first (catalog order), then custom ones by name. Inactive ones only when asked. */
    /** Runs `fn` in one transaction of the school's database; repository calls made inside it join it. */
    transaction<T>(fn: () => Promise<T>): Promise<T>;
    findAll(includeInactive: boolean): Promise<EventTypeEntity[]>;
    findById(id: string): Promise<EventTypeEntity | null>;
    findByKey(key: string): Promise<EventTypeEntity | null>;
    countCustom(): Promise<number>;
    /** Takes the school's "event types" lock until the surrounding transaction ends. Serialises creations so the cap cannot be overrun. */
    lockForCreate(): Promise<void>;
    /** Inserts. A taken name throws the domain error EVENT_TYPE_NAME_TAKEN. The caller picks a free key first (under the lock), because a failed insert would abort the open transaction. */
    create(data: NewEventType): Promise<EventTypeEntity>;
    /** Updates. A taken name -> EVENT_TYPE_NAME_TAKEN; a trigger refusal -> EVENT_TYPE_PROTECTED. */
    update(id: string, changes: EventTypeChanges): Promise<EventTypeEntity>;
    countEventsUsing(id: string): Promise<number>;
    /** Deletes. A database refusal (still referenced, or a system row) becomes EVENT_TYPE_IN_USE / EVENT_TYPE_PROTECTED. */
    remove(id: string): Promise<void>;
}
