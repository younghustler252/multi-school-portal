import { asClass }                    from "awilix";
import type { AwilixContainer }       from "awilix";
import {
    ClassMapper,
    ClassProgressionMapper,
    SubjectMapper,
    ClassSubjectMapper,
}                                     from "./mappers/class.mapper";
import { ClassRepositoryImpl }        from "./repositories/class.repository.impl";
import { CreateClassUseCase }         from "./usecases/school-admin/create-class.usecase";
import { UpdateClassUseCase }         from "./usecases/school-admin/update-class.usecase";
import { GetClassesUseCase }          from "./usecases/school-admin/get-classes.usecase";
import { GetClassByIdUseCase }        from "./usecases/school-admin/get-class-by-id.usecase";
import { SetClassTeacherUseCase }     from "./usecases/school-admin/set-classteacher.usecase";
import { DeleteClassUseCase }         from "./usecases/school-admin/delete-class.usecase";
import { CreateSubjectUseCase }       from "./usecases/school-admin/create-subject.usecase";
import { UpdateSubjectUseCase }       from "./usecases/school-admin/update-subject.usecase";
import { SubjectPresenter } from "./services/subject-presenter";
import { GetSubjectsUseCase }         from "./usecases/school-admin/get-subjects.usecase";
import { AssignSubjectUseCase }       from "./usecases/school-admin/assign-subject.usecase";
import { SetSubjectDefaultTeacherUseCase } from "./usecases/school-admin/set-subject-default-teacher.usecase";
import { GetClassSubjectsUseCase }    from "./usecases/school-admin/get-class-subjects.usecase";
import { RemoveSubjectUseCase }       from "./usecases/school-admin/remove-subject.usecase";
import { SetClassProgressionUseCase } from "./usecases/school-admin/set-class-progression.usecase";
import { BulkAssignSubjectsUseCase }  from "./usecases/school-admin/bulk-assign-subject.usecase";
import { ClearSubjectOverrideUseCase } from "./usecases/school-admin/clear-subject-override.usecase";
import { ClassSubjectResolutionService } from "./services/class-subject-resolution-service";
import { ApplyDefaultsUseCase } from "./usecases/school-admin/apply-default-usecase";
import { StaffNameLookup } from "./services/staff-names";
import { TeachingModelReader } from "./services/teaching-model";
import { ClassPresenter } from "./services/class-presenter";
import { ClassController }             from "./controllers/class.controller";

/*
|--------------------------------------------------------------------------
| CLASSES CONTAINER
| Requires: registerStaff (staffRepository), registerAuth (userRepository), registerSessions (sessionRepository),
|           registerAudit (auditService), registerFoundation (accessService).
|--------------------------------------------------------------------------
*/

export const registerClasses = (container: AwilixContainer): void => {
    container.register({
        classMapper:                    asClass(ClassMapper).singleton(),
        classProgressionMapper:         asClass(ClassProgressionMapper).scoped(),
        subjectMapper:                  asClass(SubjectMapper).singleton(),
        classSubjectMapper:             asClass(ClassSubjectMapper).singleton(),

        classRepository:                asClass(ClassRepositoryImpl).scoped(),
        staffNameLookup:                asClass(StaffNameLookup).scoped(),
        teachingModelReader:            asClass(TeachingModelReader).singleton(),
        classPresenter:                 asClass(ClassPresenter).scoped(),

        classSubjectResolutionService:  asClass(ClassSubjectResolutionService).scoped(),

        createClassUseCase:             asClass(CreateClassUseCase).scoped(),
        updateClassUseCase:             asClass(UpdateClassUseCase).scoped(),
        getClassesUseCase:              asClass(GetClassesUseCase).scoped(),
        getClassByIdUseCase:            asClass(GetClassByIdUseCase).scoped(),
        setClassTeacherUseCase:         asClass(SetClassTeacherUseCase).scoped(),
        deleteClassUseCase:             asClass(DeleteClassUseCase).scoped(),

        createSubjectUseCase:           asClass(CreateSubjectUseCase).scoped(),
        getSubjectsUseCase:             asClass(GetSubjectsUseCase).scoped(),
        updateSubjectUseCase:           asClass(UpdateSubjectUseCase).scoped(),
        subjectPresenter:               asClass(SubjectPresenter).scoped(),
        assignSubjectUseCase:           asClass(AssignSubjectUseCase).scoped(),
        setSubjectDefaultTeacherUseCase: asClass(SetSubjectDefaultTeacherUseCase).scoped(),
        getClassSubjectsUseCase:        asClass(GetClassSubjectsUseCase).scoped(),
        removeSubjectUseCase:           asClass(RemoveSubjectUseCase).scoped(),
        setClassProgressionUseCase:     asClass(SetClassProgressionUseCase).scoped(),
        bulkAssignSubjectsUseCase:      asClass(BulkAssignSubjectsUseCase).scoped(),
        clearSubjectOverrideUseCase:    asClass(ClearSubjectOverrideUseCase).scoped(),
        applyDefaultsUseCase:           asClass(ApplyDefaultsUseCase).scoped(),
        classController:                asClass(ClassController).scoped(),
    });
};
