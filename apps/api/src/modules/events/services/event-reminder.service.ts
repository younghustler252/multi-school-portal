import { IEventRepository } from "../repositories/event.repository";
import { ISchoolRepository } from "../../school/repositories/school.repository";
import type { CalendarEventEntity } from "../domain/event.entity";
import { planReminders } from "../domain/event.reminders";

interface Deps { eventRepository: IEventRepository; schoolRepository: Pick<ISchoolRepository, "findById"> }

/*
| KEEPS THE REMINDER ROWS RIGHT after anything that changes an event. Called by publish, reschedule, cancel, an offset change
| and the old calendar date edit. A published event has one row per offset for its current revision; any other state has none pending.
*/
export class EventReminderService {
    constructor(private readonly d: Deps) {}

    async sync(schoolId: string, event: CalendarEventEntity, now: Date = new Date()): Promise<void> {
        if (event.status !== "PUBLISHED") { await this.d.eventRepository.cancelPendingReminders(event.id); return; }
        const tz = (await this.d.schoolRepository.findById(schoolId))?.timezone || "UTC";
        await this.d.eventRepository.syncReminders(event.id, planReminders(event, tz, now));
    }
}
