import { Request, Response, NextFunction } from "express";
import { CreateGuardianUseCase }  from "../usecases/create-guardian.usecase";
import { GetGuardianUseCase }     from "../usecases/get-guardian.usecase";
import { ListGuardiansUseCase }   from "../usecases/list-guardians.usecase";
import { UpdateGuardianUseCase }  from "../usecases/update-guardian.usecase";
import { InviteGuardianUseCase }  from "../usecases/invite-guardian.usecase";
import { LinkGuardianUseCase }    from "../usecases/link-guardian.usecase";
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
}

export class GuardianController {
    private readonly createGuardianUseCase: CreateGuardianUseCase;
    private readonly getGuardianUseCase:    GetGuardianUseCase;
    private readonly listGuardiansUseCase:  ListGuardiansUseCase;
    private readonly updateGuardianUseCase: UpdateGuardianUseCase;
    private readonly inviteGuardianUseCase: InviteGuardianUseCase;
    private readonly linkGuardianUseCase:   LinkGuardianUseCase;

    constructor({
        createGuardianUseCase,
        getGuardianUseCase,
        listGuardiansUseCase,
        updateGuardianUseCase,
        inviteGuardianUseCase,
        linkGuardianUseCase,
    }: Dependencies) {
        this.createGuardianUseCase = createGuardianUseCase;
        this.getGuardianUseCase    = getGuardianUseCase;
        this.listGuardiansUseCase  = listGuardiansUseCase;
        this.updateGuardianUseCase = updateGuardianUseCase;
        this.inviteGuardianUseCase = inviteGuardianUseCase;
        this.linkGuardianUseCase   = linkGuardianUseCase;
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

    // ── Create guardian ───────────────────────────────────────────────────
    createGuardian = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createGuardianUseCase.execute(req.body);
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
                req.body.schoolName ?? "Your School",
                req.body.subdomain  ?? "",
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
}