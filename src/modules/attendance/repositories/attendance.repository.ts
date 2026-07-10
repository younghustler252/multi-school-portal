import { Prisma } from "../../../generated/prisma/client";
import { AttendanceEntity }  from "../domain/attendance.entity";
import {
    PaginatedResult,
    PaginateParams,
}                            from "../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| ATTENDANCE REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/

export interface IAttendanceRepository {
    findById(id: string):                            Promise<AttendanceEntity | null>;
    findOne(where: Record<string, any>):             Promise<AttendanceEntity | null>;
    findMany(where?: Record<string, any>):           Promise<AttendanceEntity[]>;
    paginate(params: PaginateParams):                Promise<PaginatedResult<AttendanceEntity>>;
    create(data: Prisma.AttendanceUncheckedCreateInput):               Promise<AttendanceEntity>;
    update(id: string, data: Record<string, any>):   Promise<AttendanceEntity>;
    exists(where: Record<string, any>):              Promise<boolean>;
    count(where?: Record<string, any>):              Promise<number>;
    bulkCreate(data: Prisma.AttendanceUncheckedCreateInput[]):         Promise<AttendanceEntity[]>;

    // ── Attendance specific ───────────────────────────────────────────────
    findByStudentAndDate(
        studentId: string,
        date:      Date,
    ):                                               Promise<AttendanceEntity | null>;
    findByTermAndDate(
        termId: string,
        date:   Date,
    ):                                               Promise<AttendanceEntity[]>;
    findByStudentAndTerm(
        studentId: string,
        termId:    string,
    ):                                               Promise<AttendanceEntity[]>;
    countByStatus(
        studentId: string,
        termId:    string,
        status:    string,
    ):                                               Promise<number>;
}