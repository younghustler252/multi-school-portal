import { Request, Response, NextFunction } from "express";
import { Role } from "../../generated/public";
import { UnauthorizedError, ForbiddenError } from "../../shared/errors/domain.errors";
/*
|--------------------------------------------------------------------------
| RBAC MIDDLEWARE
| Role-based access control
| Usage: router.get("/", authenticate, requireRoles("school_admin"), handler)
|--------------------------------------------------------------------------
*/

export const requireRoles = (...roles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(new UnauthorizedError());
            return;
        }

        if (!roles.includes(req.user.role as Role)) {
            next(new ForbiddenError(
                `Access denied. Required roles: ${roles.join(", ")}`,
            ));
            return;
        }

        next();
    };
};

/*
|--------------------------------------------------------------------------
| SUPER ADMIN ONLY
|--------------------------------------------------------------------------
*/
export const requireSuperAdmin = requireRoles(Role.super_admin);

/*
|--------------------------------------------------------------------------
| SCHOOL ADMIN ONLY
|--------------------------------------------------------------------------
*/
export const requireSchoolAdmin = requireRoles(
    Role.school_admin,
    Role.super_admin,
);

/*
|--------------------------------------------------------------------------
| SCHOOL STAFF (admin, principal, teacher, bursar)
|--------------------------------------------------------------------------
*/
export const requireStaff = requireRoles(
    Role.super_admin,
    Role.school_admin,
    Role.principal,
    Role.teacher,
    Role.bursar,
);

/*
|--------------------------------------------------------------------------
| REQUIRE SAME SCHOOL
| Ensures a school-scoped user can only access their own school's data
|--------------------------------------------------------------------------
*/
export const requireSameSchool = (
    req:  Request,
    res:  Response,
    next: NextFunction,
): void => {
    if (!req.user) {
        next(new UnauthorizedError());
        return;
    }

    // Super admin can access any school
    if (req.user.role === Role.super_admin) {
        return next();
    }

    const schoolId = req.params.schoolId || req.body.schoolId;

    if (schoolId && req.user.schoolId !== schoolId) {
        next(new ForbiddenError("You do not have access to this school"));
        return;
    }

    next();
};