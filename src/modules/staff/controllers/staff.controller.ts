import { Request, Response, NextFunction } from "express";
import { CreateStaffUseCase }    from "../usecases/create-staff.usecase";
import { GetStaffUseCase }       from "../usecases/get-staff.usecase";
import { ListStaffUseCase }      from "../usecases/list-staff.usecase";
import { UpdateStaffUseCase }    from "../usecases/update-staff.usecase";
import { DeactivateStaffUseCase } from "../usecases/deactivate-staff.usecase";
import { ReactivateStaffUseCase } from "../usecases/reactivate-staff.usecase";
import { GetMyClassesUseCase } from "../usecases/get-my-class.usecase";
import { GetStaffAssignmentsUseCase } from "../usecases/get-staff-assignments";
import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| STAFF CONTROLLER
|--------------------------------------------------------------------------
*/

interface Dependencies {
    createStaffUseCase:     CreateStaffUseCase;
    getStaffUseCase:        GetStaffUseCase;
    listStaffUseCase:       ListStaffUseCase;
    updateStaffUseCase:     UpdateStaffUseCase;
    deactivateStaffUseCase: DeactivateStaffUseCase;
    reactivateStaffUseCase:  ReactivateStaffUseCase;
    getMyClassesUseCase: GetMyClassesUseCase;
    getStaffAssignmentsUseCase: GetStaffAssignmentsUseCase;
}

export class StaffController {
    private readonly createStaffUseCase:     CreateStaffUseCase;
    private readonly getStaffUseCase:        GetStaffUseCase;
    private readonly listStaffUseCase:       ListStaffUseCase;
    private readonly updateStaffUseCase:     UpdateStaffUseCase;
    private readonly deactivateStaffUseCase: DeactivateStaffUseCase;
    private readonly reactivateStaffUseCase:  ReactivateStaffUseCase;
    private readonly getMyClassesUseCase: GetMyClassesUseCase;
    private readonly getStaffAssignmentsUseCase: GetStaffAssignmentsUseCase;
    

    constructor({
        createStaffUseCase,
        getStaffUseCase,
        listStaffUseCase,
        updateStaffUseCase,
        deactivateStaffUseCase,
        reactivateStaffUseCase,
        getMyClassesUseCase,
        getStaffAssignmentsUseCase

    }: Dependencies) {
        this.createStaffUseCase     = createStaffUseCase;
        this.getStaffUseCase        = getStaffUseCase;
        this.listStaffUseCase       = listStaffUseCase;
        this.updateStaffUseCase     = updateStaffUseCase;
        this.deactivateStaffUseCase = deactivateStaffUseCase;
        this.reactivateStaffUseCase  = reactivateStaffUseCase;
        this.getMyClassesUseCase = getMyClassesUseCase;
        this.getStaffAssignmentsUseCase = getStaffAssignmentsUseCase;
    }

    // ── List all staff ────────────────────────────────────────────────────
    listStaff = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.listStaffUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) {
            next(err);
        }
    };

    // ── Get single staff ──────────────────────────────────────────────────
    getStaff = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getStaffUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Staff member retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Create staff ──────────────────────────────────────────────────────
    createStaff = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createStaffUseCase.execute(
                req.body,
                req.user!.schoolId!,
                req.user?.id as string,
            );
            sendCreated(res, result, "Staff member created successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Update staff ──────────────────────────────────────────────────────
    updateStaff = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateStaffUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Staff member updated successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Deactivate staff ──────────────────────────────────────────────────
    deactivateStaff = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.deactivateStaffUseCase.execute(
                req.params.id as string,
                req.user!.id,
            );
            sendSuccess(res, result, "Staff member deactivated successfully");
        } catch (err) {
            next(err);
        }
    };


    // ── Reactivate staff ────────────────────────────────────────────────
    reactivateStaff = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.reactivateStaffUseCase.execute(
                req.params.id as string,
                req.user?.id as string,
            );

            sendSuccess(
                res,
                result,
                "Staff member reactivated successfully",
            );
        } catch (err) {
            next(err);
        }
    };

        // ── Get my classes ────────────────────────────────────────────────────
    getMyClasses = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getMyClassesUseCase.execute(
                req.user!.id,
            );
            sendSuccess(res, result, "Classes retrieved successfully");
        } catch (err) {
            next(err);
        }
    };


        // ── Get staff assignments ─────────────────────────────────────────────
    getStaffAssignments = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getStaffAssignmentsUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Staff assignments retrieved successfully");
        } catch (err) {
            next(err);
        }
    };


}