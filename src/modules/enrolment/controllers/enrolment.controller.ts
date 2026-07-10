import { Request, Response, NextFunction } from "express";
import { EnrolStudentUseCase }   from "../usecases/enrol-student.usecase";
import { BulkEnrolUseCase }      from "../usecases/bulk-enrol.usecase";
import { GetEnrolmentsUseCase }  from "../usecases/get-enrolments.usecase";
import { UpdateEnrolmentUseCase } from "../usecases/update-enrolment.usecase";
import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| ENROLMENT CONTROLLER
|--------------------------------------------------------------------------
*/

interface Dependencies {
    enrolStudentUseCase:   EnrolStudentUseCase;
    bulkEnrolUseCase:      BulkEnrolUseCase;
    getEnrolmentsUseCase:  GetEnrolmentsUseCase;
    updateEnrolmentUseCase: UpdateEnrolmentUseCase;
}

export class EnrolmentController {
    private readonly enrolStudentUseCase:    EnrolStudentUseCase;
    private readonly bulkEnrolUseCase:       BulkEnrolUseCase;
    private readonly getEnrolmentsUseCase:   GetEnrolmentsUseCase;
    private readonly updateEnrolmentUseCase: UpdateEnrolmentUseCase;

    constructor({
        enrolStudentUseCase,
        bulkEnrolUseCase,
        getEnrolmentsUseCase,
        updateEnrolmentUseCase,
    }: Dependencies) {
        this.enrolStudentUseCase    = enrolStudentUseCase;
        this.bulkEnrolUseCase       = bulkEnrolUseCase;
        this.getEnrolmentsUseCase   = getEnrolmentsUseCase;
        this.updateEnrolmentUseCase = updateEnrolmentUseCase;
    }

    // ── List enrolments ───────────────────────────────────────────────────
    getEnrolments = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getEnrolmentsUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) { next(err); }
    };

    // ── Enrol single student ──────────────────────────────────────────────
    enrolStudent = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.enrolStudentUseCase.execute(req.body);
            sendCreated(res, result, "Student enrolled successfully");
        } catch (err) { next(err); }
    };

    // ── Bulk enrol students ───────────────────────────────────────────────
    bulkEnrol = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.bulkEnrolUseCase.execute(req.body);
            sendCreated(res, result, `Enrolled ${result.enrolled.length} student(s). Skipped ${result.skipped.length}.`);
        } catch (err) { next(err); }
    };

    // ── Update enrolment status ───────────────────────────────────────────
    updateEnrolment = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateEnrolmentUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Enrolment updated successfully");
        } catch (err) { next(err); }
    };
}