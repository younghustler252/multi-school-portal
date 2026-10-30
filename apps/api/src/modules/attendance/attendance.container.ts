import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { AttendanceRepository } from "./repositories/attendance.repository";
import { AttendancePresenter } from "./services/attendance-presenter";
import { GetRegisterUseCase } from "./usecases/get-register.usecase";
import { SubmitRegisterUseCase } from "./usecases/submit-register.usecase";
import { UpdateAttendanceUseCase } from "./usecases/update-attendance.usecase";
import { ListAttendanceUseCase } from "./usecases/list-attendance.usecase";
import { StudentSummaryUseCase, ClassSummaryUseCase } from "./usecases/attendance-summaries.usecases";
import { AttendanceController } from "./controllers/attendance.controller";

/*
| ATTENDANCE CONTAINER.
| Requires: registerAuth (userRepository), registerAudit (auditService), registerFoundation (accessService).
*/
export const registerAttendance = (container: AwilixContainer): void => {
    container.register({
        attendanceRepository:     asClass(AttendanceRepository).scoped(),
        attendancePresenter:      asClass(AttendancePresenter).scoped(),

        getRegisterUseCase:       asClass(GetRegisterUseCase).scoped(),
        submitRegisterUseCase:    asClass(SubmitRegisterUseCase).scoped(),
        updateAttendanceUseCase:  asClass(UpdateAttendanceUseCase).scoped(),
        listAttendanceUseCase:    asClass(ListAttendanceUseCase).scoped(),
        studentSummaryUseCase:    asClass(StudentSummaryUseCase).scoped(),
        classSummaryUseCase:      asClass(ClassSummaryUseCase).scoped(),

        attendanceController:     asClass(AttendanceController).scoped(),
    });
};
