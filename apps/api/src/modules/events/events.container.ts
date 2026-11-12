import { asClass, asValue } from "awilix";
import { env } from "../../config/env";
import type { AwilixContainer } from "awilix";
import { EventMapper } from "./mappers/event.mapper";
import { EventRepositoryImpl } from "./repositories/event.repository.impl";
import { ListEventsUseCase, GetEventUseCase, CreateEventUseCase, UpdateEventUseCase, DeleteEventUseCase, CancelEventUseCase } from "./usecases/events.usecases";
import { ListCalendarEventsUseCase, CreateCalendarEventUseCase, UpdateCalendarEventUseCase, DeleteCalendarEventUseCase } from "./usecases/legacy-calendar.usecases";
import { PublishEventUseCase, RescheduleEventUseCase, CancelPublishedEventUseCase, NotifyEventUseCase, PreviewEventAudienceUseCase } from "./usecases/event-lifecycle.usecases";
import { RunDueEventRemindersUseCase, RunEventRemindersForAllSchoolsUseCase } from "./usecases/event-reminders.usecases";
import { EventReminderService } from "./services/event-reminder.service";
import { UploadEventCoverUseCase, RemoveEventCoverUseCase } from "./usecases/event-cover.usecases";
import { EventViewerService } from "./services/event-viewer.service";
import { EventNoticeService } from "./services/event-notice.service";
import { EventController } from "./controllers/event.controller";

/*
| EVENTS CONTAINER. Requires: registerAudit (auditService), registerFoundation, registerSessions (sessionRepository),
| registerBranches (branchRepository), registerClasses (classRepository), registerSchool (schoolRepository),
| registerNotifications (dispatch, channel policy, audience recipients), registerStudents, registerGuardians, registerStaff, registerShared (storageService).
| The four *CalendarEventUseCase names are the OLD Sessions calendar routes' use cases; they now live here, on the events model.
*/
export const registerEvents = (container: AwilixContainer): void => {
    container.register({
        eventMapper:     asClass(EventMapper).singleton(),
        eventRepository: asClass(EventRepositoryImpl).scoped(),

        listEventsUseCase:  asClass(ListEventsUseCase).scoped(),
        getEventUseCase:    asClass(GetEventUseCase).scoped(),
        createEventUseCase: asClass(CreateEventUseCase).scoped(),
        updateEventUseCase: asClass(UpdateEventUseCase).scoped(),
        deleteEventUseCase: asClass(DeleteEventUseCase).scoped(),
        cancelEventUseCase: asClass(CancelEventUseCase).scoped(),
        publishEventUseCase:         asClass(PublishEventUseCase).scoped(),
        rescheduleEventUseCase:      asClass(RescheduleEventUseCase).scoped(),
        cancelPublishedEventUseCase: asClass(CancelPublishedEventUseCase).scoped(),
        notifyEventUseCase:          asClass(NotifyEventUseCase).scoped(),
        previewEventAudienceUseCase: asClass(PreviewEventAudienceUseCase).scoped(),
        eventCoverBucket: asValue(env.supabase.publicBucket),     // covers are shown on public pages and in notices, like the school logo
        uploadEventCoverUseCase: asClass(UploadEventCoverUseCase).scoped(),
        removeEventCoverUseCase: asClass(RemoveEventCoverUseCase).scoped(),
        eventViewerService: asClass(EventViewerService).scoped(),
        eventNoticeService: asClass(EventNoticeService).scoped(),
        eventReminderService: asClass(EventReminderService).scoped(),
        runDueEventRemindersUseCase: asClass(RunDueEventRemindersUseCase).scoped(),
        runEventRemindersForAllSchoolsUseCase: asClass(RunEventRemindersForAllSchoolsUseCase).scoped(),

        listCalendarEventsUseCase:  asClass(ListCalendarEventsUseCase).scoped(),
        createCalendarEventUseCase: asClass(CreateCalendarEventUseCase).scoped(),
        updateCalendarEventUseCase: asClass(UpdateCalendarEventUseCase).scoped(),
        deleteCalendarEventUseCase: asClass(DeleteCalendarEventUseCase).scoped(),

        eventController: asClass(EventController).scoped(),
    });
};
