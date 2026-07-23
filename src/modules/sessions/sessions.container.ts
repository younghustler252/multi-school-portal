import { asClass }                    from "awilix";
import type { AwilixContainer }       from "awilix";
import { SessionMapper, TermMapper }  from "./mappers/session.mapper";
import { SessionRepositoryImpl }      from "./repositories/session.repository.impl";
import { GetSessionsUseCase }         from "./usecases/get-sessions.usecase";
import { GetCurrentSessionUseCase }   from "./usecases/get-current-session.usecase";
import { CreateSessionUseCase }       from "./usecases/create-session.usecase";
import { SetCurrentSessionUseCase }   from "./usecases/set-current-session.usecase";
import { CreateTermUseCase }          from "./usecases/create-term.usecase";
import { UpdateTermUseCase }          from "./usecases/update-term.usecase";
import { SetCurrentTermUseCase }      from "./usecases/set-current-term.usecase";
import { SessionController }          from "./controllers/session.controller";

export const registerSessions = (container: AwilixContainer): void => {
    container.register({
        sessionMapper:           asClass(SessionMapper).singleton(),
        termMapper:              asClass(TermMapper).singleton(),
        sessionRepository:       asClass(SessionRepositoryImpl).scoped(),
        getSessionsUseCase:      asClass(GetSessionsUseCase).scoped(),
        getCurrentSessionUseCase: asClass(GetCurrentSessionUseCase).scoped(),
        createSessionUseCase:    asClass(CreateSessionUseCase).scoped(),
        setCurrentSessionUseCase: asClass(SetCurrentSessionUseCase).scoped(),
        createTermUseCase:       asClass(CreateTermUseCase).scoped(),
        updateTermUseCase:       asClass(UpdateTermUseCase).scoped(),
        setCurrentTermUseCase:   asClass(SetCurrentTermUseCase).scoped(),
        sessionController:       asClass(SessionController).scoped(),
    });
};