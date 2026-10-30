import { Request, Response, NextFunction } from "express";
import { GetRegisterUseCase } from "../usecases/get-register.usecase";
import { SubmitRegisterUseCase } from "../usecases/submit-register.usecase";
import { UpdateAttendanceUseCase } from "../usecases/update-attendance.usecase";
import { ListAttendanceUseCase } from "../usecases/list-attendance.usecase";
import { StudentSummaryUseCase, ClassSummaryUseCase } from "../usecases/attendance-summaries.usecases";
import { sendSuccess } from "../../../shared/utils/api-response";
import { getAccess } from "../../../infrastructure/middleware/rbac.middleware";
import { RegisterQuery, ListAttendanceQuery, StudentSummaryQuery, ClassSummaryQuery } from "../dtos/attendance.dto";
import { attendanceErrors } from "../domain/attendance.errors";
import { AttendanceActor } from "../domain/attendance.types";

interface Dependencies {
    getRegisterUseCase: GetRegisterUseCase; submitRegisterUseCase: SubmitRegisterUseCase; updateAttendanceUseCase: UpdateAttendanceUseCase;
    listAttendanceUseCase: ListAttendanceUseCase; studentSummaryUseCase: StudentSummaryUseCase; classSummaryUseCase: ClassSummaryUseCase;
}

/*
| ATTENDANCE CONTROLLER (school realm, /attendance). The school is the host's school; the acting person comes ONLY from
| the verified session (req.auth), never from the body or URL.
*/
const schoolIdOf = (req: Request): string => req.schoolId as string;
const actorOf = (req: Request): AttendanceActor => { if (!req.auth) throw attendanceErrors.recordNotFound(); return { userId: req.auth.userId }; };

export class AttendanceController {
    constructor(private readonly d: Dependencies) {}

    // The validate middleware does not write query values back, so queries are parsed here
    register = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getRegisterUseCase.execute(String(req.params.classId), RegisterQuery.parse(req.query).date, getAccess(req)), "Register retrieved successfully"); } catch (e) { next(e); } };
    submit   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.submitRegisterUseCase.execute(schoolIdOf(req), String(req.params.classId), req.body, getAccess(req), actorOf(req)), "Register saved"); } catch (e) { next(e); } };
    update   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateAttendanceUseCase.execute(schoolIdOf(req), String(req.params.id), req.body, getAccess(req), actorOf(req)), "Attendance updated"); } catch (e) { next(e); } };
    list     = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listAttendanceUseCase.execute(ListAttendanceQuery.parse(req.query), getAccess(req));
            res.status(200).json({ success: true, message: "Attendance retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    studentSummary = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.studentSummaryUseCase.execute(StudentSummaryQuery.parse(req.query), getAccess(req)), "Attendance summary retrieved successfully"); } catch (e) { next(e); } };
    classSummary   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.classSummaryUseCase.execute(String(req.params.classId), ClassSummaryQuery.parse(req.query), getAccess(req)), "Class attendance summary retrieved successfully"); } catch (e) { next(e); } };
}
