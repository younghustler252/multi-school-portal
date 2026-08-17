import { Request, Response, NextFunction } from "express";
import { MarkAttendanceUseCase }       from "../usecases/mark-attendance.usecase";
import { BulkMarkAttendanceUseCase }   from "../usecases/bulk-mark-attendance.usecase";
import { GetAttendanceUseCase }        from "../usecases/get-attendance.usecase";
import { GetAttendanceSummaryUseCase } from "../usecases/get-attendance-summary.usecase";
import { UpdateAttendanceUseCase }     from "../usecases/update-attendance.usecase";
import { GetMyChildrenAttendanceUseCase } from "../usecases/get-my-childreen-attendance";
import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                      from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| ATTENDANCE CONTROLLER
|--------------------------------------------------------------------------
*/

interface Dependencies {
    markAttendanceUseCase:       MarkAttendanceUseCase;
    bulkMarkAttendanceUseCase:   BulkMarkAttendanceUseCase;
    getAttendanceUseCase:        GetAttendanceUseCase;
    getAttendanceSummaryUseCase: GetAttendanceSummaryUseCase;
    updateAttendanceUseCase:     UpdateAttendanceUseCase;
    getMyChildrenAttendanceUseCase: GetMyChildrenAttendanceUseCase;
}

export class AttendanceController {
    private readonly markAttendanceUseCase:       MarkAttendanceUseCase;
    private readonly bulkMarkAttendanceUseCase:   BulkMarkAttendanceUseCase;
    private readonly getAttendanceUseCase:        GetAttendanceUseCase;
    private readonly getAttendanceSummaryUseCase: GetAttendanceSummaryUseCase;
    private readonly updateAttendanceUseCase:     UpdateAttendanceUseCase;
    private readonly getMyChildrenAttendanceUseCase:     GetMyChildrenAttendanceUseCase;

    constructor({
        markAttendanceUseCase,
        bulkMarkAttendanceUseCase,
        getAttendanceUseCase,
        getAttendanceSummaryUseCase,
        updateAttendanceUseCase,
        getMyChildrenAttendanceUseCase
    }: Dependencies) {
        this.markAttendanceUseCase       = markAttendanceUseCase;
        this.bulkMarkAttendanceUseCase   = bulkMarkAttendanceUseCase;
        this.getAttendanceUseCase        = getAttendanceUseCase;
        this.getAttendanceSummaryUseCase = getAttendanceSummaryUseCase;
        this.updateAttendanceUseCase     = updateAttendanceUseCase;
        this.getMyChildrenAttendanceUseCase = getMyChildrenAttendanceUseCase;
    }

    // ── Get attendance records ────────────────────────────────────────────
    getAttendance = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getAttendanceUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };

    // ── Get attendance summary for a student ──────────────────────────────
    getAttendanceSummary = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getAttendanceSummaryUseCase.execute(
                req.params.studentId as string,
                req.query.termId     as string,
            );
            sendSuccess(res, result, "Attendance summary retrieved");
        } catch (err) { next(err); }
    };

    // ── Mark single attendance ────────────────────────────────────────────
    markAttendance = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.markAttendanceUseCase.execute(req.body);
            sendCreated(res, result, "Attendance marked successfully");
        } catch (err) { next(err); }
    };

    // ── Bulk mark attendance ──────────────────────────────────────────────
    bulkMarkAttendance = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.bulkMarkAttendanceUseCase.execute(
                req.body,
            );
            sendCreated(
                res,
                result,
                `Marked ${result.marked.length} record(s). Skipped ${result.skipped.length}.`,
            );
        } catch (err) { next(err); }
    };

    // ── Update attendance ─────────────────────────────────────────────────
    updateAttendance = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateAttendanceUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Attendance updated successfully");
        } catch (err) { next(err); }
    };

    // ── Get my children's attendance ─────────────────────────────────────────
    getMyChildrenAttendance = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getMyChildrenAttendanceUseCase.execute(
                req.user?.id as string,
                {
                    studentId: req.query.studentId as string | undefined,
                    termId: req.query.termId as string | undefined,
                    page: req.query.page
                        ? Number(req.query.page)
                        : undefined,
                    limit: req.query.limit
                        ? Number(req.query.limit)
                        : undefined,
                },
            );

            sendPaginated(res, result.data, result.meta);
        } catch (err) {
            next(err);
        }
    };
}