import { Request, Response, NextFunction } from "express";
import { TenantContext }                   from "../database/prisma/tenant.context";
import { prisma }                          from "../database/prisma/prisma.client";
import { env }                             from "../../config/env";

export const resolveTenant = async (
    req:  Request,
    res:  Response,
    next: NextFunction,
): Promise<void> => {
    try {
        // ── Development override via headers ──────────────────────────────
        if (env.NODE_ENV === "development") {
            const devSchema   = req.headers["x-tenant-schema"] as string;
            const devSchoolId = req.headers["x-school-id"]     as string;

            if (devSchema && devSchoolId) {
                req.tenantSchema = devSchema;
                req.schoolId     = devSchoolId;

                TenantContext.run(
                    { tenantSchema: devSchema, schoolId: devSchoolId },
                    () => next(),
                );
                return;
            }
        }

        // ── Production — extract from subdomain ───────────────────────────
        const host      = req.headers.host ?? "";
        const parts     = host.split(".");
        const subdomain = parts.length > 2 ? parts[0].toLowerCase() : null;

        if (
            !subdomain          ||
            subdomain === "www" ||
            subdomain === env.ADMIN_SUBDOMAIN
        ) {
            return next();
        }

        const school = await prisma.school.findFirst({
            where: { subdomain, isActive: true },
            select: { id: true, schemaName: true, status: true },
        });

        if (!school || !school.schemaName) {
            res.status(404).json({
                success: false,
                message: `School portal '${subdomain}' not found`,
            });
            return;
        }

        if (school.status !== "active") {
            res.status(403).json({
                success: false,
                message: "This school account is not currently active",
            });
            return;
        }

        req.tenantSchema = school.schemaName;
        req.schoolId     = school.id;

        TenantContext.run(
            { tenantSchema: school.schemaName, schoolId: school.id },
            () => next(),
        );

    } catch (err) {
        next(err);
    }
};

/*
|--------------------------------------------------------------------------
| REQUIRE TENANT
| Checks tenant context exists on the request
|--------------------------------------------------------------------------
*/
export const requireTenant = (
    req:  Request,
    res:  Response,
    next: NextFunction,
): void => {
    if (!req.tenantSchema || !req.schoolId) {
        res.status(400).json({
            success: false,
            message: "No school context. Please access via your school subdomain.",
        });
        return;
    }
    next();
};

/*
|--------------------------------------------------------------------------
| VALIDATE TENANT OWNERSHIP
| Runs AFTER authenticate — ensures user belongs to the resolved school
| Place this after authenticate + requireTenant in protected routes
|--------------------------------------------------------------------------
*/
export const validateTenantOwnership = (
    req:  Request,
    res:  Response,
    next: NextFunction,
): void => {
    // No user — skip (public routes, auth routes)
    if (!req.user) return next();

    // No school context — skip (platform routes, super admin)
    if (!req.schoolId) return next();

    // Super admin can access any school
    if (req.user.role === "super_admin") return next();

    // User must belong to the resolved school
    if (req.user.schoolId !== req.schoolId) {
        res.status(403).json({
            success: false,
            message: "You do not have access to this school portal.",
        });
        return;
    }

    next();
};