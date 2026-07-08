import { Request, Response, NextFunction } from "express";
import { TenantContext }                   from "../database/prisma/tenant.context";
import { prisma }                          from "../database/prisma/prisma.client";
import {
    BadRequestError,
    UnauthorizedError,
}                                          from "../../shared/errors/domain.errors";
import { env }                             from "../../config/env";

/*
|--------------------------------------------------------------------------
| TENANT RESOLVER MIDDLEWARE
| Extracts school subdomain from request host
| Looks up school in DB, sets tenant schema in AsyncLocalStorage
| Must run on every request before route handlers
|--------------------------------------------------------------------------
*/

export const resolveTenant = async (
    req:  Request,
    res:  Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const host = req.hostname;
        const parts = host.split(".");

        // Extract subdomain
        // greenfield.schoolportal.com → greenfield
        const subdomain = parts.length > 2 ? parts[0].toLowerCase() : null;

        // ── Public / admin routes — no tenant context needed ──────────────
        if (
            !subdomain          ||
            subdomain === "www" ||
            subdomain === env.ADMIN_SUBDOMAIN
        ) {
            return next();
        }

        // ── Look up school by subdomain ───────────────────────────────────
        const school = await prisma.school.findFirst({
            where: {
                subdomain,
                isActive: true,
            },
            select: {
                id:         true,
                schemaName: true,
                status:     true,
                isActive:   true,
            },
        });

        if (!school || !school.schemaName) {
            throw new BadRequestError(
                `School portal '${subdomain}' not found or suspended.`,
            );
        }

        if (school.status !== "active") {
            throw new BadRequestError(
                "This school account is not currently active.",
            );
        }

        // ── Cross-school access check ─────────────────────────────────────
        // If user is already authenticated, verify they belong to this school
        if (req.user && req.user.role !== "super_admin") {
            if (req.user.schoolId !== school.id) {
                throw new UnauthorizedError(
                    "You do not have access to this school portal.",
                );
            }
        }

        // ── Set tenant context for this request ───────────────────────────
        req.tenantSchema = school.schemaName;
        req.schoolId     = school.id;

        TenantContext.run(
            {
                tenantSchema: school.schemaName,
                schoolId:     school.id,
            },
            () => next(),
        );

    } catch (err) {
        next(err);
    }
};

/*
|--------------------------------------------------------------------------
| REQUIRE TENANT
| Use on routes that must have a tenant context
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