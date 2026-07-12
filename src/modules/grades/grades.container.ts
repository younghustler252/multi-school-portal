import { asClass }                      from "awilix";
import type { AwilixContainer }         from "awilix";
import { GradeMapper, GradingConfigMapper } from "./mappers/grade.mapper";
import { GradeRepositoryImpl }          from "./repositories/grade.repository.impl";
import { EnterGradeUseCase }            from "./usecases/enter-grade.usecase";
import { BulkEnterGradesUseCase }       from "./usecases/bulk-enter-grades.usecase";
import { GetGradesUseCase }             from "./usecases/get-grades.usecase";
import { UpdateGradeUseCase }           from "./usecases/update-grade.usecase";
import { PublishGradesUseCase }         from "./usecases/publish-grades.usecase";
import { GetGradingConfigUseCase }      from "./usecases/get-grading-config.usecase";
import { UpdateGradingConfigUseCase }   from "./usecases/update-grading-config.usecase";
import { GradeController }              from "./controllers/grade.controller";

/*
|--------------------------------------------------------------------------
| GRADES CONTAINER
|--------------------------------------------------------------------------
*/

export const registerGrades = (container: AwilixContainer): void => {
    container.register({
        gradeMapper:               asClass(GradeMapper).singleton(),
        gradingConfigMapper:       asClass(GradingConfigMapper).singleton(),
        gradeRepository:           asClass(GradeRepositoryImpl).scoped(),
        enterGradeUseCase:         asClass(EnterGradeUseCase).scoped(),
        bulkEnterGradesUseCase:    asClass(BulkEnterGradesUseCase).scoped(),
        getGradesUseCase:          asClass(GetGradesUseCase).scoped(),
        updateGradeUseCase:        asClass(UpdateGradeUseCase).scoped(),
        publishGradesUseCase:      asClass(PublishGradesUseCase).scoped(),
        getGradingConfigUseCase:   asClass(GetGradingConfigUseCase).scoped(),
        updateGradingConfigUseCase: asClass(UpdateGradingConfigUseCase).scoped(),
        gradeController:           asClass(GradeController).scoped(),
    });
};