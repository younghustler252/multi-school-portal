import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { StudentMapper } from "./mappers/student.mapper";
import { StudentRepositoryImpl } from "./repositories/student.repository.impl";
import { NumberSequenceService } from "../../shared/services/number-sequence.service";
import { CreateStudentUseCase } from "./usecases/create-student.usecase";
import { UpdateStudentUseCase } from "./usecases/update-student.usecase";
import { DeactivateStudentUseCase } from "./usecases/deactivate-student.usecase";
import { ReactivateStudentUseCase } from "./usecases/reactivate-student.usecase";
import { ListStudentsUseCase, GetStudentUseCase, GetMyStudentProfileUseCase } from "./usecases/student-queries.usecases";
import { UploadStudentPhotoUseCase } from "./usecases/upload-photo.usecase";
import { StudentController } from "./controllers/student.controller";

/*
| STUDENTS CONTAINER.
| Requires: registerShared (storageService), registerFoundation (accessService), registerAudit (auditService).
| Not registered on purpose: ImportStudentsUseCase and GetStudentsBatchUseCase (see routes/student.routes.ts).
*/
export const registerStudents = (container: AwilixContainer): void => {
    container.register({
        studentMapper:         asClass(StudentMapper).singleton(),
        studentRepository:     asClass(StudentRepositoryImpl).scoped(),
        numberSequenceService: asClass(NumberSequenceService).singleton(),

        listStudentsUseCase:         asClass(ListStudentsUseCase).scoped(),
        getStudentUseCase:           asClass(GetStudentUseCase).scoped(),
        getMyStudentProfileUseCase:  asClass(GetMyStudentProfileUseCase).scoped(),
        createStudentUseCase:        asClass(CreateStudentUseCase).scoped(),
        updateStudentUseCase:        asClass(UpdateStudentUseCase).scoped(),
        deactivateStudentUseCase:    asClass(DeactivateStudentUseCase).scoped(),
        reactivateStudentUseCase:    asClass(ReactivateStudentUseCase).scoped(),
        uploadStudentPhotoUseCase:   asClass(UploadStudentPhotoUseCase).scoped(),

        studentController:           asClass(StudentController).scoped(),
    });
};
