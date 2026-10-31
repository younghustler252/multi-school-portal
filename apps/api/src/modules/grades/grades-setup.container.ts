import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { GradesSetupRepository } from "./repositories/grades-setup.repository";
import { ListScalesUseCase, SaveScaleUseCase, DeleteScaleUseCase, ListSchemesUseCase, SaveSchemeUseCase, DeleteSchemeUseCase } from "./usecases/grades-setup.usecases";
import { GradesSetupController } from "./controllers/grades-setup.controller";

/* GRADES SETUP CONTAINER. Requires: registerAudit (auditService). */
export const registerGradesSetup = (container: AwilixContainer): void => {
    container.register({
        gradesSetupRepository: asClass(GradesSetupRepository).scoped(),
        listScalesUseCase:     asClass(ListScalesUseCase).scoped(),
        saveScaleUseCase:      asClass(SaveScaleUseCase).scoped(),
        deleteScaleUseCase:    asClass(DeleteScaleUseCase).scoped(),
        listSchemesUseCase:    asClass(ListSchemesUseCase).scoped(),
        saveSchemeUseCase:     asClass(SaveSchemeUseCase).scoped(),
        deleteSchemeUseCase:   asClass(DeleteSchemeUseCase).scoped(),
        gradesSetupController: asClass(GradesSetupController).scoped(),
    });
};
