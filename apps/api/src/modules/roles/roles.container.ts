import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { RolesRepository } from "./repositories/roles.repository";
import { ListRolesUseCase, GetRoleUseCase, ListRoleMembersUseCase, ListPermissionsUseCase, CreateRoleUseCase, UpdateRoleUseCase, DeleteRoleUseCase } from "./usecases/roles.usecases";
import { RolesController } from "./controllers/roles.controller";

/*
| ROLES CONTAINER.
| Requires: registerShared (prismaClient, the PUBLIC client — for the permission catalog), registerFoundation
| (accessService), registerAudit (auditService).
*/
export const registerRoles = (container: AwilixContainer): void => {
    container.register({
        rolesRepository:        asClass(RolesRepository).scoped(),
        listRolesUseCase:       asClass(ListRolesUseCase).scoped(),
        getRoleUseCase:         asClass(GetRoleUseCase).scoped(),
        listRoleMembersUseCase: asClass(ListRoleMembersUseCase).scoped(),
        listPermissionsUseCase: asClass(ListPermissionsUseCase).scoped(),
        createRoleUseCase:      asClass(CreateRoleUseCase).scoped(),
        updateRoleUseCase:      asClass(UpdateRoleUseCase).scoped(),
        deleteRoleUseCase:      asClass(DeleteRoleUseCase).scoped(),
        rolesController:        asClass(RolesController).scoped(),
    });
};
