import { Request, Response, NextFunction } from "express";
import { CreateGuardianUseCase }  from "../usecases/create-guardian.usecase";
import { GetGuardianUseCase }     from "../usecases/get-guardian.usecase";
import { ListGuardiansUseCase }   from "../usecases/list-guardians.usecase";
import { UpdateGuardianUseCase }  from "../usecases/update-guardian.usecase";
import { InviteGuardianUseCase }  from "../usecases/invite-guardian.usecase";
import { LinkGuardianUseCase }    from "../usecases/link-guardian.usecase";
import { GetMyChildrenUseCase } from "../usecases/get-my-children.usecase";
import { BulkInviteGuardiansUseCase } from "../usecases/bulk-invite-guardian.usecase";

import { BulkInviteGuardiansDto } from "../dtos/guardian.dto";
import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                 from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| GUARDIAN CONTROLLER
|--------------------------------------------------------------------------
*/

interface Dependencies {
    createGuardianUseCase: CreateGuardianUseCase;
    getGuardianUseCase:    GetGuardianUseCase;
    listGuardiansUseCase:  ListGuardiansUseCase;
    updateGuardianUseCase: UpdateGuardianUseCase;
    inviteGuardianUseCase: InviteGuardianUseCase;
    linkGuardianUseCase:   LinkGuardianUseCase;
    bulkInviteGuardiansUseCase: BulkInviteGuardiansUseCase;
    getMyChildrenUseCase: GetMyChildrenUseCase;

}

export class GuardianController {
    private readonly createGuardianUseCase: CreateGuardianUseCase;
    private readonly getGuardianUseCase:    GetGuardianUseCase;
    private readonly listGuardiansUseCase:  ListGuardiansUseCase;
    private readonly updateGuardianUseCase: UpdateGuardianUseCase;
    private readonly inviteGuardianUseCase: InviteGuardianUseCase;
    private readonly linkGuardianUseCase:   LinkGuardianUseCase;
    private readonly bulkInviteGuardiansUseCase:   BulkInviteGuardiansUseCase;
    private readonly getMyChildrenUseCase: GetMyChildrenUseCase;

    constructor({
        createGuardianUseCase,
        getGuardianUseCase,
        getMyChildrenUseCase,
        listGuardiansUseCase,
        updateGuardianUseCase,
        inviteGuardianUseCase,
        linkGuardianUseCase,
        bulkInviteGuardiansUseCase,
    }: Dependencies) {
        this.createGuardianUseCase = createGuardianUseCase;
        this.getGuardianUseCase    = getGuardianUseCase;
        this.getMyChildrenUseCase  = getMyChildrenUseCase
        this.listGuardiansUseCase  = listGuardiansUseCase;
        this.updateGuardianUseCase = updateGuardianUseCase;
        this.inviteGuardianUseCase = inviteGuardianUseCase;
        this.linkGuardianUseCase   = linkGuardianUseCase;
        this.bulkInviteGuardiansUseCase = bulkInviteGuardiansUseCase;
    }

    // ── List guardians ────────────────────────────────────────────────────
    listGuardians = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.listGuardiansUseCase.execute(
                req.query as any,
            );
            sendPaginated(res, result.data, result.meta);
        } catch (err) {
            next(err);
        }
    };

    // ── Get guardian ──────────────────────────────────────────────────────
    getGuardian = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getGuardianUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Guardian retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    getMyChildren = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getMyChildrenUseCase.execute(
                req.user?.id as string,
            );

            sendSuccess(res, result, "Children retrieved successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Create guardian ───────────────────────────────────────────────────
    createGuardian = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createGuardianUseCase.execute(
                req.body, 
                req.user!.schoolId!,
                req.user?.id as string,
            );
            sendCreated(res, result, "Guardian created successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Update guardian ───────────────────────────────────────────────────
    updateGuardian = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateGuardianUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Guardian updated successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Invite guardian to portal ─────────────────────────────────────────
    inviteGuardian = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.inviteGuardianUseCase.execute(
                { guardianId: req.params.id as string },
                req.schoolId as string,
            );
            sendSuccess(res, null, result.message);
        } catch (err) {
            next(err);
        }
    };
    // ── Link guardian to another student ──────────────────────────────────
    linkGuardian = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.linkGuardianUseCase.execute(
                req.params.id as string,
                req.body,
            );
            sendSuccess(res, result, "Guardian linked to student successfully");
        } catch (err) {
            next(err);
        }
    };

    bulkInviteGuardians = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const dto = BulkInviteGuardiansDto.parse(req.body);
            const result = await this.bulkInviteGuardiansUseCase.execute(dto, req.schoolId as string);
            sendSuccess(res, result, `${result.sent} invitation(s) sent`);
        } catch (err) {
            next(err);
        }
    };
}