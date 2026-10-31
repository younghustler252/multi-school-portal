import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { GradesSetupRepository } from "./repositories/grades-setup.repository";
import { ListScalesUseCase, SaveScaleUseCase, DeleteScaleUseCase, ListSchemesUseCase, SaveSchemeUseCase, DeleteSchemeUseCase } from "./usecases/grades-setup.usecases";
import { GradesSetupController } from "./controllers/grades-setup.controller";
import { GradesSheetsRepository } from "./repositories/grades-sheets.repository";
import { ListSheetsUseCase, GetSheetUseCase, ListGradesUseCase } from "./usecases/grades-sheets-read.usecases";
import { SaveScoresUseCase } from "./usecases/save-scores.usecase";
import { SheetTransitionUseCase } from "./usecases/sheet-transition.usecase";
import { GradesSheetsController } from "./controllers/grades-sheets.controller";
import { GradeRepositoryImpl } from "./repositories/grade.repository.impl";

/* GRADES CONTAINER (setup + mark sheets). Requires: registerAudit (auditService). */
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

        gradesSheetsRepository:  asClass(GradesSheetsRepository).scoped(),
        listSheetsUseCase:       asClass(ListSheetsUseCase).scoped(),
        getSheetUseCase:         asClass(GetSheetUseCase).scoped(),
        listGradesUseCase:       asClass(ListGradesUseCase).scoped(),
        saveScoresUseCase:       asClass(SaveScoresUseCase).scoped(),
        sheetTransitionUseCase:  asClass(SheetTransitionUseCase).scoped(),
        gradesSheetsController:  asClass(GradesSheetsController).scoped(),
        gradeRepository:         asClass(GradeRepositoryImpl).scoped(),   // read-only, published results (used by report cards)
    });
};
