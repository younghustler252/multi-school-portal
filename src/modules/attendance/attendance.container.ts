import { asClass }                      from "awilix";
import type { AwilixContainer }         from "awilix";
import { AttendanceMapper }             from "./mappers/attendance.mapper";
import { AttendanceRepositoryImpl }     from "./repositories/attendance.repository.impl";
import { MarkAttendanceUseCase }        from "./usecases/mark-attendance.usecase";
import { BulkMarkAttendanceUseCase }    from "./usecases/bulk-mark-attendance.usecase";
import { GetAttendanceUseCase }         from "./usecases/get-attendance.usecase";
import { GetAttendanceSummaryUseCase }  from "./usecases/get-attendance-summary.usecase";
import { UpdateAttendanceUseCase }      from "./usecases/update-attendance.usecase";
import { GetMyChildrenAttendanceUseCase } from "./usecases/get-my-childreen-attendance";
import { AttendanceController }         from "./controllers/attendance.controller";

/*
|--------------------------------------------------------------------------
| ATTENDANCE CONTAINER
|--------------------------------------------------------------------------
*/

export const registerAttendance = (container: AwilixContainer): void => {
    container.register({
        attendanceMapper:            asClass(AttendanceMapper).singleton(),
        attendanceRepository:        asClass(AttendanceRepositoryImpl).scoped(),
        markAttendanceUseCase:       asClass(MarkAttendanceUseCase).scoped(),
        bulkMarkAttendanceUseCase:   asClass(BulkMarkAttendanceUseCase).scoped(),
        getAttendanceUseCase:        asClass(GetAttendanceUseCase).scoped(),
        getAttendanceSummaryUseCase: asClass(GetAttendanceSummaryUseCase).scoped(),
        updateAttendanceUseCase:     asClass(UpdateAttendanceUseCase).scoped(),
        getMyChildrenAttendanceUseCase: asClass(GetMyChildrenAttendanceUseCase).scoped(),
        attendanceController:        asClass(AttendanceController).scoped(),
    });
};