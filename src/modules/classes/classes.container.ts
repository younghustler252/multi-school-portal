import { asClass }                    from "awilix";
import type { AwilixContainer }       from "awilix";
import {
    ClassMapper,
    SubjectMapper,
    ClassSubjectMapper,
}                                     from "./mappers/class.mapper";
import { ClassRepositoryImpl }        from "./repositories/class.repository.impl";
import { CreateClassUseCase }         from "./usecases/school-admin/create-class.usecase";
import { UpdateClassUseCase }         from "./usecases/school-admin/update-class.usecase";
import { GetClassesUseCase }          from "./usecases/school-admin/get-classes.usecase";
import { DeleteClassUseCase }         from "./usecases/school-admin/delete-class.usecase";
import { CreateSubjectUseCase }       from "./usecases/school-admin/create-subject.usecase";
import { GetSubjectsUseCase }         from "./usecases/school-admin/get-subjects.usecase";
import { AssignSubjectUseCase }       from "./usecases/school-admin/assign-subject.usecase";
import { GetClassSubjectsUseCase }    from "./usecases/school-admin/get-class-subjects.usecase";
import { RemoveSubjectUseCase }       from "./usecases/school-admin/remove-subject.usecase";
import { ClassController }            from "./controllers/class.controller";

/*
|--------------------------------------------------------------------------
| CLASSES CONTAINER
|--------------------------------------------------------------------------
*/

export const registerClasses = (container: AwilixContainer): void => {
    container.register({
        classMapper:             asClass(ClassMapper).singleton(),
        subjectMapper:           asClass(SubjectMapper).singleton(),
        classSubjectMapper:      asClass(ClassSubjectMapper).singleton(),
        classRepository:         asClass(ClassRepositoryImpl).scoped(),
        createClassUseCase:      asClass(CreateClassUseCase).scoped(),
        updateClassUseCase:      asClass(UpdateClassUseCase).scoped(),
        getClassesUseCase:       asClass(GetClassesUseCase).scoped(),
        deleteClassUseCase:      asClass(DeleteClassUseCase).scoped(),
        createSubjectUseCase:    asClass(CreateSubjectUseCase).scoped(),
        getSubjectsUseCase:      asClass(GetSubjectsUseCase).scoped(),
        assignSubjectUseCase:    asClass(AssignSubjectUseCase).scoped(),
        getClassSubjectsUseCase: asClass(GetClassSubjectsUseCase).scoped(),
        removeSubjectUseCase:    asClass(RemoveSubjectUseCase).scoped(),
        classController:         asClass(ClassController).scoped(),
    });
};