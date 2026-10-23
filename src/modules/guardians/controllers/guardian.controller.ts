import { Request, Response, NextFunction } from "express";
import { CreateGuardianUseCase } from "../usecases/create-guardian.usecase";
import { UpdateGuardianUseCase } from "../usecases/update-guardian.usecase";
import { LinkGuardianUseCase, UpdateGuardianLinkUseCase, UnlinkGuardianUseCase } from "../usecases/guardian-links.usecases";
import { InviteGuardianUseCase, BulkInviteGuardiansUseCase } from "../usecases/guardian-invites.usecases";
import { ListGuardiansUseCase, GetGuardianUseCase, GetMyChildrenUseCase } from "../usecases/guardian-queries.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { getAccess } from "../../../infrastructure/middleware/rbac.middleware";
import { ListGuardiansQuery } from "../dtos/guardian.dto";
import { guardianErrors } from "../domain/guardian.errors";
import { GuardianActor } from "../domain/guardian.types";

interface Dependencies {
    listGuardiansUseCase: ListGuardiansUseCase; getGuardianUseCase: GetGuardianUseCase; getMyChildrenUseCase: GetMyChildrenUseCase;
    createGuardianUseCase: CreateGuardianUseCase; updateGuardianUseCase: UpdateGuardianUseCase;
    linkGuardianUseCase: LinkGuardianUseCase; updateGuardianLinkUseCase: UpdateGuardianLinkUseCase; unlinkGuardianUseCase: UnlinkGuardianUseCase;
    inviteGuardianUseCase: InviteGuardianUseCase; bulkInviteGuardiansUseCase: BulkInviteGuardiansUseCase;
}

/*
| GUARDIAN CONTROLLER (school realm, /guardians). The school is the host's school; the acting person comes ONLY
| from the verified session (req.auth), never from the body or URL.
*/
const schoolIdOf = (req: Request): string => req.schoolId as string;
const idOf = (req: Request): string => String(req.params.id);
const actorOf = (req: Request): GuardianActor => {
    if (!req.auth) throw guardianErrors.notFound();
    const access = getAccess(req);
    return {
        userId: req.auth.userId, membershipId: req.auth.membershipId, access,
        ip: req.ip ?? req.socket.remoteAddress ?? "unknown", userAgent: req.get("user-agent") ?? null,
        isAdmin: access.hasRoleKey("school_admin"),
    };
};

export class GuardianController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // The validate middleware does not write query values back, so the query is parsed here
            const r = await this.d.listGuardiansUseCase.execute(ListGuardiansQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Guardians retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };

    get = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getGuardianUseCase.execute(idOf(req), getAccess(req)), "Guardian retrieved successfully"); } catch (e) { next(e); } };
    myChildren = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getMyChildrenUseCase.execute(getAccess(req)), "Children retrieved successfully"); } catch (e) { next(e); } };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.createGuardianUseCase.execute(schoolIdOf(req), req.body, actorOf(req));
            if (r.outcome === "already_linked") return sendSuccess(res, r, "This guardian was already linked to the student");
            sendCreated(res, r, r.outcome === "created" ? "Guardian created successfully" : "Existing guardian linked to the student");
        } catch (e) { next(e); }
    };

    update = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateGuardianUseCase.execute(schoolIdOf(req), idOf(req), req.body, actorOf(req)), "Guardian updated successfully"); } catch (e) { next(e); } };
    link = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.linkGuardianUseCase.execute(schoolIdOf(req), idOf(req), req.body, actorOf(req)), "Guardian linked to student"); } catch (e) { next(e); } };
    updateLink = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateGuardianLinkUseCase.execute(schoolIdOf(req), idOf(req), String(req.params.studentId), req.body, actorOf(req)), "Link updated successfully"); } catch (e) { next(e); } };
    unlink = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.unlinkGuardianUseCase.execute(schoolIdOf(req), idOf(req), String(req.params.studentId), actorOf(req)), "Guardian unlinked from student"); } catch (e) { next(e); } };
    invite = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.inviteGuardianUseCase.execute(schoolIdOf(req), idOf(req), actorOf(req)), "Invitation sent"); } catch (e) { next(e); } };

    bulkInvite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.bulkInviteGuardiansUseCase.execute(schoolIdOf(req), req.body, actorOf(req));
            sendSuccess(res, r, `${r.sent} invitation(s) sent`);
        } catch (e) { next(e); }
    };
}
