import { Request, Response, NextFunction } from "express";
import { container } from "../../container";
import {
    ForbiddenError, PermissionDeniedError, TenantMismatchError, UnauthorizedError,
} from "../../shared/errors/domain.errors";
import { Access, AccessService, Persona } from "../../foundation/access.service";

/*
|-----------------------------------------------------------------------..---
| RBAC MIDDLEWARE
| Order per route: resolveTenant -> authenticate -> requirePermission(...)
| Every guard here loads access itself if loadAccess has not run yet, so the
| order of the last two never matters.
|
|   requirePermission("fees.refund")        holds this permission (any scope)
|   requireAnyPermission("a", "b")          holds at least one
|   requirePersona("GUARDIAN")              portal-specific endpoints ("my children")
|   getAccess(req).scopeOf("grades.enter")  inside use cases: ALL / ASSIGNED / OWN
|
| There is no role-name guard: authority is a permission (with a scope), never a role name.
|--------------------------------------------------------------------------
*/

const accessService = () => container.resolve<AccessService>("accessService");

export async function ensureAccess(req: Request): Promise<Access> {
    if (req.access) return req.access;

    const auth = req.auth;
    if (!auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING");

    const resolved = req.schoolId && req.schoolId !== "PUBLIC" ? req.schoolId : null;

    if (auth.schoolId) {
        if (auth.schoolId !== resolved) throw new TenantMismatchError();
    } else if (resolved) {
        throw new ForbiddenError(
            "Platform sessions cannot act inside a school. Use impersonation.",
            "PLATFORM_SESSION_IN_SCHOOL",
        );
    }

    if (!auth.membershipId) throw new UnauthorizedError("Session is no longer valid", "SESSION_INVALID");

    const access = await accessService().load({
        realm:        auth.schoolId ? "school" : "platform",
        membershipId: auth.membershipId,
        userId:       auth.userId,
    });

    req.access = access;
    return access;
}

export const getAccess = (req: Request): Access => {
    if (!req.access) throw new UnauthorizedError("Access has not been loaded for this request");
    return req.access;
};

const guard = (check: (access: Access) => void) =>
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            check(await ensureAccess(req));
            next();
        } catch (err) {
            next(err);
        }
    };

export const loadAccess = guard(() => undefined);

export const requirePermission = (key: string) =>
    guard((access) => { if (!access.can(key)) throw new PermissionDeniedError(key); });

export const requireAnyPermission = (...keys: string[]) =>
    guard((access) => {
        if (!keys.some((k) => access.can(k))) throw new PermissionDeniedError(keys.join(" | "));
    });

export const requirePersona = (...personas: Persona[]) =>
    guard((access) => {
        if (!access.persona || !personas.includes(access.persona)) {
            throw new ForbiddenError(`Access denied. Required: ${personas.join(", ")}`, "PERSONA_FORBIDDEN", { personas });
        }
    });
