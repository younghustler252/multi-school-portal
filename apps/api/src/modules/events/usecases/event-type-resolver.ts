import type { IEventTypeRepository } from "../repositories/event-type.repository";
import type { EventTypeEntity } from "../domain/event-type.entity";
import { eventTypeErrors } from "../domain/event-type.errors";
import { HOLIDAY_TYPE_ID } from "../domain/event-type.catalog";

export const DEFAULT_TYPE_KEY = "event";
export const isHolidayType = (t: Pick<EventTypeEntity, "id">): boolean => t.id === HOLIDAY_TYPE_ID;

/*
| Finds the type an event asks for, by key or id. Unknown -> 400. An inactive type can stay on the events that already have it,
| but cannot be chosen for a new event or moved to by an update (`current` is the type the event already has).
*/
export async function resolveEventType(repo: Pick<IEventTypeRepository, "findById" | "findByKey">, pick: { type?: string; eventTypeId?: string }, current?: { eventTypeId: string | null }): Promise<EventTypeEntity> {
    const found = pick.eventTypeId ? await repo.findById(pick.eventTypeId) : await repo.findByKey(pick.type ?? DEFAULT_TYPE_KEY);
    if (!found) throw eventTypeErrors.unknown();
    if (!found.isActive && current?.eventTypeId !== found.id) throw eventTypeErrors.inactive();
    return found;
}
