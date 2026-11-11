import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { EventMapper } from "./mappers/event.mapper";
import { EventRepositoryImpl } from "./repositories/event.repository.impl";
import { ListEventsUseCase, GetEventUseCase, CreateEventUseCase, UpdateEventUseCase, DeleteEventUseCase, CancelEventUseCase } from "./usecases/events.usecases";
import { ListCalendarEventsUseCase, CreateCalendarEventUseCase, UpdateCalendarEventUseCase, DeleteCalendarEventUseCase } from "./usecases/legacy-calendar.usecases";
import { EventController } from "./controllers/event.controller";

/*
| EVENTS CONTAINER. Requires: registerAudit (auditService), registerFoundation, registerSessions (sessionRepository),
| registerBranches (branchRepository), registerClasses (classRepository).
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

        listCalendarEventsUseCase:  asClass(ListCalendarEventsUseCase).scoped(),
        createCalendarEventUseCase: asClass(CreateCalendarEventUseCase).scoped(),
        updateCalendarEventUseCase: asClass(UpdateCalendarEventUseCase).scoped(),
        deleteCalendarEventUseCase: asClass(DeleteCalendarEventUseCase).scoped(),

        eventController: asClass(EventController).scoped(),
    });
};
