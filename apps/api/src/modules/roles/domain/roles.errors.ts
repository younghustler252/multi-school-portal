import { AppError, NotFoundError, ForbiddenError } from "../../../shared/errors/domain.errors";

/* Role errors. Codes are stable; the frontend switches on them. */
export const roleErrors = {
    notFound:        () => new NotFoundError("Role"),
    permissionsInvalid: (keys: string[]) => new AppError(`Not a real permission: ${keys.join(", ")}`, 422, true, "ROLE_PERMISSIONS_INVALID", { keys }),
    notDelegatable:  () => new ForbiddenError("You cannot hand out a permission (or a scope of one) that you do not hold yourself"),
    grantsAllNotAllowed: () => new ForbiddenError("Only a School Admin role may have access to everything; a custom or edited role cannot"),
    locked:          () => new AppError("This role is set by the platform and cannot be changed or deleted", 409, true, "ROLE_LOCKED"),
    nameTaken:       () => new AppError("A role with this name already exists", 409, true, "ROLE_NAME_TAKEN"),
    inUse:           (count: number) => new AppError(`${count} ${count === 1 ? "person" : "people"} still ${count === 1 ? "has" : "have"} this role. Move them to another role first`, 409, true, "ROLE_IN_USE", { count }),
    personaNotAllowed: () => new AppError("A new role can only be for staff. Student and guardian roles are fixed", 422, true, "ROLE_PERSONA_NOT_ALLOWED"),
};
