import { asClass }                    from "awilix";
import type { AwilixContainer }       from "awilix";
import { EnrolmentMapper }            from "./mappers/enrolment.mapper";
import { EnrolmentRepositoryImpl }    from "./repositories/enrolment.repository.impl";
import { EnrolStudentUseCase }        from "./usecases/enrol-student.usecase";
import { BulkEnrolUseCase }           from "./usecases/bulk-enrol.usecase";
import { GetEnrolmentsUseCase }       from "./usecases/get-enrolments.usecase";
import { UpdateEnrolmentUseCase }     from "./usecases/update-enrolment.usecase";
import { EnrolmentController }        from "./controllers/enrolment.controller";

/*
|--------------------------------------------------------------------------
| ENROLMENT CONTAINER
|--------------------------------------------------------------------------
*/

export const registerEnrolment = (container: AwilixContainer): void => {
    container.register({
        enrolmentMapper:         asClass(EnrolmentMapper).singleton(),
        enrolmentRepository:     asClass(EnrolmentRepositoryImpl).scoped(),
        enrolStudentUseCase:     asClass(EnrolStudentUseCase).scoped(),
        bulkEnrolUseCase:        asClass(BulkEnrolUseCase).scoped(),
        getEnrolmentsUseCase:    asClass(GetEnrolmentsUseCase).scoped(),
        updateEnrolmentUseCase:  asClass(UpdateEnrolmentUseCase).scoped(),
        enrolmentController:     asClass(EnrolmentController).scoped(),
    });
};