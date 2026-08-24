import { asClass }                    from "awilix";
import type { AwilixContainer }       from "awilix";
import { StudentMapper }              from "./mappers/student.mapper";
import { StudentRepositoryImpl }      from "./repositories/student.repository.impl";
import { CreateStudentUseCase }       from "./usecases/create-student.usecase";
import { GetStudentUseCase }          from "./usecases/get-student.usecase";
import { GetStudentsBatchUseCase } from "./usecases/get-students-batch.usecase";
import { ListStudentsUseCase }        from "./usecases/list-students.usecase";
import { UpdateStudentUseCase }       from "./usecases/update-student.usecase";
import { DeactivateStudentUseCase }   from "./usecases/deactivate-student.usecase";
import { UploadStudentPhotoUseCase }  from "./usecases/upload-photo.usecase";
import { StudentController }          from "./controllers/student.controller";

/*
|--------------------------------------------------------------------------
| STUDENTS CONTAINER
|--------------------------------------------------------------------------
*/

export const registerStudents = (container: AwilixContainer): void => {
    container.register({
        studentMapper:             asClass(StudentMapper).singleton(),
        studentRepository:         asClass(StudentRepositoryImpl).scoped(),
        createStudentUseCase:      asClass(CreateStudentUseCase).scoped(),
        getStudentUseCase:         asClass(GetStudentUseCase).scoped(),
        listStudentsUseCase:       asClass(ListStudentsUseCase).scoped(),
        updateStudentUseCase:      asClass(UpdateStudentUseCase).scoped(),
        deactivateStudentUseCase:  asClass(DeactivateStudentUseCase).scoped(),
        uploadStudentPhotoUseCase: asClass(UploadStudentPhotoUseCase).scoped(),
        getStudentsBatchUseCase:   asClass(GetStudentsBatchUseCase).scoped(),

        studentController:         asClass(StudentController).scoped(),
    });
};