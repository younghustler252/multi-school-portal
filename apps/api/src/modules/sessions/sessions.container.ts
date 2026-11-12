import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { SessionMapper, TermMapper } from "./mappers/session.mapper";
import { SessionRepositoryImpl } from "./repositories/session.repository.impl";
import { ListSessionsUseCase, GetCurrentAcademicYearUseCase } from "./usecases/session-queries.usecases";
import { CreateSessionUseCase, UpdateSessionUseCase, CreateTermUseCase, UpdateTermUseCase } from "./usecases/session-commands.usecases";
import { SetCurrentSessionUseCase, SetCurrentTermUseCase } from "./usecases/set-current.usecases";
import { SessionController } from "./controllers/session.controller";

/*
| SESSIONS CONTAINER. Requires: registerAudit (auditService), registerFoundation (accessService).
| The calendar routes' use cases now live in the events module (registerEvents).
| `sessionRepository` is also used by Staff, Students, Fees and other modules: keep its method names.
*/
export const registerSessions = (container: AwilixContainer): void => {
    container.register({
        sessionMapper:       asClass(SessionMapper).singleton(),
        termMapper:          asClass(TermMapper).singleton(),
        sessionRepository:   asClass(SessionRepositoryImpl).scoped(),

        listSessionsUseCase:             asClass(ListSessionsUseCase).scoped(),
        getCurrentAcademicYearUseCase:   asClass(GetCurrentAcademicYearUseCase).scoped(),
        createSessionUseCase:            asClass(CreateSessionUseCase).scoped(),
        updateSessionUseCase:            asClass(UpdateSessionUseCase).scoped(),
        createTermUseCase:               asClass(CreateTermUseCase).scoped(),
        updateTermUseCase:               asClass(UpdateTermUseCase).scoped(),
        setCurrentSessionUseCase:        asClass(SetCurrentSessionUseCase).scoped(),
        setCurrentTermUseCase:           asClass(SetCurrentTermUseCase).scoped(),

        sessionController:               asClass(SessionController).scoped(),
    });
};
