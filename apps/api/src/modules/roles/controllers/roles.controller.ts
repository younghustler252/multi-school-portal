import { Request, Response, NextFunction } from "express";
import { ListRolesUseCase, GetRoleUseCase, ListRoleMembersUseCase, ListPermissionsUseCase, CreateRoleUseCase, UpdateRoleUseCase, DeleteRoleUseCase } from "../usecases/roles.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { getAccess } from "../../../infrastructure/middleware/rbac.middleware";
import { RoleParams, ListRolesQuery, CreateRoleDto, UpdateRoleDto } from "../dtos/role.dto";
import { RolesActor } from "../domain/roles.types";
import { roleErrors } from "../domain/roles.errors";

interface Dependencies {
    listRolesUseCase: ListRolesUseCase; getRoleUseCase: GetRoleUseCase; listRoleMembersUseCase: ListRoleMembersUseCase;
    listPermissionsUseCase: ListPermissionsUseCase; createRoleUseCase: CreateRoleUseCase; updateRoleUseCase: UpdateRoleUseCase; deleteRoleUseCase: DeleteRoleUseCase;
}

/* ROLES CONTROLLER (school realm, /roles and /permissions). The acting person comes ONLY from the verified session. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const idOf = (req: Request): string => RoleParams.parse(req.params).id;
const actorOf = (req: Request): RolesActor => {
    if (!req.auth) throw roleErrors.notFound();
    return { userId: req.auth.userId, access: getAccess(req) };
};

export class RolesController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listRolesUseCase.execute(ListRolesQuery.parse(req.query)), "Roles retrieved successfully"); } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getRoleUseCase.execute(idOf(req)), "Role retrieved successfully"); } catch (e) { next(e); }
    };
    members = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listRoleMembersUseCase.execute(idOf(req)), "Role members retrieved successfully"); } catch (e) { next(e); }
    };
    permissions = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listPermissionsUseCase.execute(), "Permissions retrieved successfully"); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createRoleUseCase.execute(schoolIdOf(req), CreateRoleDto.parse(req.body), actorOf(req)), "Role created"); } catch (e) { next(e); }
    };
    update = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateRoleUseCase.execute(schoolIdOf(req), idOf(req), UpdateRoleDto.parse(req.body), actorOf(req)), "Role updated"); } catch (e) { next(e); }
    };
    remove = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.deleteRoleUseCase.execute(schoolIdOf(req), idOf(req), actorOf(req)), "Role deleted"); } catch (e) { next(e); }
    };
}
