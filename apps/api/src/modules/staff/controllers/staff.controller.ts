import { Request, Response, NextFunction } from "express";
import { ListStaffUseCase, GetStaffUseCase, GetMyStaffProfileUseCase, ExportStaffUseCase } from "../usecases/staff-queries.usecases";
import { CreateStaffUseCase } from "../usecases/create-staff.usecase";
import { UpdateStaffUseCase } from "../usecases/update-staff.usecase";
import { SetStaffBranchesUseCase } from "../usecases/staff-branches.usecase";
import { DeactivateStaffUseCase, ReactivateStaffUseCase } from "../usecases/staff-status.usecases";
import { InviteStaffUseCase, ChangeStaffRolesUseCase } from "../usecases/staff-portal.usecases";
import { GetMyClassesUseCase, GetStaffAssignmentsUseCase } from "../usecases/staff-assignments.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { getAccess } from "../../../infrastructure/middleware/rbac.middleware";
import { ListStaffQuery } from "../dtos/staff.dto";
import { staffErrors } from "../domain/staff.errors";
import { StaffActor } from "../domain/staff.types";

interface Dependencies {
    listStaffUseCase: ListStaffUseCase; getStaffUseCase: GetStaffUseCase; getMyStaffProfileUseCase: GetMyStaffProfileUseCase;
    exportStaffUseCase: ExportStaffUseCase; createStaffUseCase: CreateStaffUseCase; updateStaffUseCase: UpdateStaffUseCase;
    setStaffBranchesUseCase: SetStaffBranchesUseCase; deactivateStaffUseCase: DeactivateStaffUseCase; reactivateStaffUseCase: ReactivateStaffUseCase;
    inviteStaffUseCase: InviteStaffUseCase; changeStaffRolesUseCase: ChangeStaffRolesUseCase;
    getMyClassesUseCase: GetMyClassesUseCase; getStaffAssignmentsUseCase: GetStaffAssignmentsUseCase;
}

/*
| STAFF CONTROLLER (school realm, /staff). The school is the host's school; the acting person comes ONLY from the
| verified session (req.auth + loaded access), never from the body or URL. The old routes took staff ids and
| user ids from the request without tying them to the caller.
*/
const schoolIdOf = (req: Request): string => req.schoolId as string;

const actorOf = (req: Request): StaffActor => {
    if (!req.auth) throw staffErrors.notFound();
    const access = getAccess(req);
    return {
        userId: req.auth.userId, membershipId: req.auth.membershipId, access,
        ip: req.ip ?? req.socket.remoteAddress ?? "unknown", userAgent: req.get("user-agent") ?? null,
        isAdmin: access.hasRoleKey("school_admin"),
    };
};
const idOf = (req: Request): string => String(req.params.id);

export class StaffController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // The validate middleware does not write query values back, so the query is parsed here
            const r = await this.d.listStaffUseCase.execute(schoolIdOf(req), ListStaffQuery.parse(req.query), getAccess(req));
            res.status(200).json({ success: true, message: "Staff retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };

    export = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { page: _p, limit: _l, ...filters } = ListStaffQuery.parse(req.query);
            const csv = await this.d.exportStaffUseCase.execute(filters, getAccess(req));
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", 'attachment; filename="staff.csv"');
            res.status(200).send(`\uFEFF${csv}`);       // BOM so Excel reads names with accents correctly
        } catch (e) { next(e); }
    };

    get  = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getStaffUseCase.execute(schoolIdOf(req), idOf(req), getAccess(req)), "Staff member retrieved successfully"); } catch (e) { next(e); } };
    me   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getMyStaffProfileUseCase.execute(schoolIdOf(req), getAccess(req)), "Profile retrieved successfully"); } catch (e) { next(e); } };
    create = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.createStaffUseCase.execute(schoolIdOf(req), req.body, actorOf(req)), "Staff member created successfully"); } catch (e) { next(e); } };
    update = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateStaffUseCase.execute(schoolIdOf(req), idOf(req), req.body, actorOf(req)), "Staff member updated successfully"); } catch (e) { next(e); } };
    setBranches = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.setStaffBranchesUseCase.execute(schoolIdOf(req), idOf(req), req.body, actorOf(req)), "Branches updated successfully"); } catch (e) { next(e); } };
    deactivate = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.deactivateStaffUseCase.execute(schoolIdOf(req), idOf(req), req.body ?? {}, actorOf(req)), "Staff member deactivated successfully"); } catch (e) { next(e); } };
    reactivate = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.reactivateStaffUseCase.execute(schoolIdOf(req), idOf(req), actorOf(req)), "Staff member reactivated successfully"); } catch (e) { next(e); } };
    invite = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.inviteStaffUseCase.execute(schoolIdOf(req), idOf(req), req.body, actorOf(req)), "Invitation sent"); } catch (e) { next(e); } };
    changeRoles = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.changeStaffRolesUseCase.execute(schoolIdOf(req), idOf(req), req.body, actorOf(req)), "Roles updated successfully"); } catch (e) { next(e); } };
    myClasses = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getMyClassesUseCase.execute(getAccess(req)), "Classes retrieved successfully"); } catch (e) { next(e); } };
    assignments = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getStaffAssignmentsUseCase.execute(idOf(req), getAccess(req)), "Assignments retrieved successfully"); } catch (e) { next(e); } };
}
