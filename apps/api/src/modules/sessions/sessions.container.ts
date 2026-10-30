import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { SessionMapper, TermMapper } from "./mappers/session.mapper";
import { CalendarEventMapper } from "./mappers/calendar.mapper";
import { SessionRepositoryImpl } from "./repositories/session.repository.impl";
import { CalendarRepositoryImpl } from "./repositories/calendar.repository.impl";
import { ListSessionsUseCase, GetCurrentAcademicYearUseCase } from "./usecases/session-queries.usecases";
import { CreateSessionUseCase, UpdateSessionUseCase, CreateTermUseCase, UpdateTermUseCase } from "./usecases/session-commands.usecases";
import { SetCurrentSessionUseCase, SetCurrentTermUseCase } from "./usecases/set-current.usecases";
import { ListCalendarEventsUseCase, CreateCalendarEventUseCase, UpdateCalendarEventUseCase, DeleteCalendarEventUseCase } from "./usecases/calendar.usecases";
import { SessionController } from "./controllers/session.controller";

/*
| SESSIONS CONTAINER. Requires: registerAudit (auditService), registerFoundation (accessService).
| `sessionRepository` is also used by Staff, Students, Fees and other modules: keep its method names.
*/
export const registerSessions = (container: AwilixContainer): void => {
    container.register({
        sessionMapper:       asClass(SessionMapper).singleton(),
        termMapper:          asClass(TermMapper).singleton(),
        calendarEventMapper: asClass(CalendarEventMapper).singleton(),
        sessionRepository:   asClass(SessionRepositoryImpl).scoped(),
        calendarRepository:  asClass(CalendarRepositoryImpl).scoped(),

        listSessionsUseCase:             asClass(ListSessionsUseCase).scoped(),
        getCurrentAcademicYearUseCase:   asClass(GetCurrentAcademicYearUseCase).scoped(),
        createSessionUseCase:            asClass(CreateSessionUseCase).scoped(),
        updateSessionUseCase:            asClass(UpdateSessionUseCase).scoped(),
        createTermUseCase:               asClass(CreateTermUseCase).scoped(),
        updateTermUseCase:               asClass(UpdateTermUseCase).scoped(),
        setCurrentSessionUseCase:        asClass(SetCurrentSessionUseCase).scoped(),
        setCurrentTermUseCase:           asClass(SetCurrentTermUseCase).scoped(),
        listCalendarEventsUseCase:       asClass(ListCalendarEventsUseCase).scoped(),
        createCalendarEventUseCase:      asClass(CreateCalendarEventUseCase).scoped(),
        updateCalendarEventUseCase:      asClass(UpdateCalendarEventUseCase).scoped(),
        deleteCalendarEventUseCase:      asClass(DeleteCalendarEventUseCase).scoped(),

        sessionController:               asClass(SessionController).scoped(),
    });
};
