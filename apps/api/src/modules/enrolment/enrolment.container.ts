import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { EnrolmentMapper } from "./mappers/enrolment.mapper";
import { EnrolmentRepositoryImpl } from "./repositories/enrolment.repository.impl";
import { EnrolmentPresenter } from "./services/enrolment-presenter";
import { ListEnrolmentsUseCase } from "./usecases/list-enrolments.usecase";
import { EnrolStudentUseCase } from "./usecases/enrol-student.usecase";
import { BulkEnrolUseCase } from "./usecases/bulk-enrol.usecase";
import { UpdateEnrolmentUseCase } from "./usecases/update-enrolment.usecase";
import { PreviewPromotionUseCase, PromoteStudentsUseCase } from "./usecases/promotion.usecases";
import { EnrolmentController } from "./controllers/enrolment.controller";

/*
| ENROLMENT CONTAINER.
| Requires: registerStudents (studentRepository, studentPhotoService), registerClasses (classRepository),
|           registerSessions (sessionRepository), registerAudit (auditService), registerFoundation (accessService).
| `enrolmentRepository` is also used by other modules (report cards, attendance, students import): keep its method names.
*/
export const registerEnrolment = (container: AwilixContainer): void => {
    container.register({
        enrolmentMapper:         asClass(EnrolmentMapper).singleton(),
        enrolmentRepository:     asClass(EnrolmentRepositoryImpl).scoped(),
        enrolmentPresenter:      asClass(EnrolmentPresenter).scoped(),

        listEnrolmentsUseCase:   asClass(ListEnrolmentsUseCase).scoped(),
        enrolStudentUseCase:     asClass(EnrolStudentUseCase).scoped(),
        bulkEnrolUseCase:        asClass(BulkEnrolUseCase).scoped(),
        updateEnrolmentUseCase:  asClass(UpdateEnrolmentUseCase).scoped(),
        previewPromotionUseCase: asClass(PreviewPromotionUseCase).scoped(),
        promoteStudentsUseCase:  asClass(PromoteStudentsUseCase).scoped(),

        enrolmentController:     asClass(EnrolmentController).scoped(),
    });
};
