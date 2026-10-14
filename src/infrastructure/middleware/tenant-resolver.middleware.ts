import { Request, Response, NextFunction } from "express";
import { TenantContext }                   from "../database/prisma/tenant.context";
import { prisma }                          from "../database/prisma/prisma.client";
import { env }                             from "../../config/env";
import { AppError, TenantMismatchError }   from "../../shared/errors/domain.errors";

/*
|--------------------------------------------------------------------------
| TENANT RESOLVER
| Decides which school (tenant schema) a request belongs to, from the host:
|   BASE_DOMAIN, www.BASE_DOMAIN, ADMIN_SUBDOMAIN.BASE_DOMAIN  -> platform (public) context
|   <subdomain>.BASE_DOMAIN                                    -> that school
|   any other host                                             -> a school's verified custom domain
| It does NOT look at who the user is. Whether the signed-in user belongs to
| this school is checked in loadAccess / requirePermission (rbac.middleware.ts).
| Order per route: resolveTenant -> authenticate -> permission checks.
|
| CHANGE: a school that is "active" but whose schema is not built yet (the few seconds after its
| owner confirmed their email) answers 503 SCHOOL_SETTING_UP instead of failing with a database error.
|--------------------------------------------------------------------------
*/

interface Target { tenantSchema: string; schoolId: string }

const PUBLIC_CONTEXT = { tenantSchema: "public", schoolId: "PUBLIC" } as const;

const headerValue = (req: Request, name: string): string | undefined => {
    const v = req.headers[name];
    return Array.isArray(v) ? v[0] : v;
};

// Development only: pick a school with headers, verified against the database.
const developmentOverride = async (req: Request): Promise<Target | null> => {
    if (env.NODE_ENV !== "development") return null;

    const devSchema   = headerValue(req, "x-tenant-schema");
    const devSchoolId = headerValue(req, "x-school-id");
    if (!devSchema && !devSchoolId) return null;

    const school = devSchoolId
        ? await prisma.school.findFirst({ where: { id: devSchoolId, deletedAt: null }, select: { id: true, schemaName: true } })
        : null;

    if (!school?.schemaName || (devSchema && school.schemaName.trim() !== devSchema.trim())) {
        throw new AppError(
            "The provided tenant schema and school ID combination is invalid or does not exist.",
            400, true, "TENANT_HEADER_INVALID",
        );
    }
    return { tenantSchema: school.schemaName, schoolId: school.id };
};

type HostKind =
    | { kind: "public" }
    | { kind: "subdomain"; subdomain: string }
    | { kind: "custom";    hostname: string }
    | { kind: "invalid" };

export const classifyHost = (hostname: string): HostKind => {
    const base = env.BASE_DOMAIN.toLowerCase();
    const host = hostname.toLowerCase();

    if (host === base || host === `www.${base}`) return { kind: "public" };

    if (host.endsWith(`.${base}`)) {
        const label = host.slice(0, -(base.length + 1));
        if (label.includes(".")) return { kind: "invalid" };                 // a.b.base is never a school
        if (label === "www" || label === env.ADMIN_SUBDOMAIN.toLowerCase()) return { kind: "public" };
        return { kind: "subdomain", subdomain: label };
    }

    return host ? { kind: "custom", hostname: host } : { kind: "public" };
};

export const resolveTenant = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
        let target: Target | null = await developmentOverride(req);

        if (!target) {
            const hostname = (req.headers.host ?? "").split(":")[0];
            const host     = classifyHost(hostname);

            if (host.kind === "public") {
                TenantContext.run({ ...PUBLIC_CONTEXT }, () => next());
                return;
            }
            if (host.kind === "invalid") {
                next(new AppError("School portal not found", 404, true, "SCHOOL_NOT_FOUND"));
                return;
            }

            const school = await prisma.school.findFirst({
                where: host.kind === "subdomain"
                    ? { subdomain: host.subdomain, deletedAt: null }
                    : { customDomain: host.hostname, customDomainVerifiedAt: { not: null }, deletedAt: null },
                select: { id: true, schemaName: true, status: true, isActive: true, schemaProvisionedAt: true },
            });

            if (!school || !school.schemaName) {
                const label = host.kind === "subdomain" ? host.subdomain : host.hostname;
                next(new AppError(`School portal '${label}' not found`, 404, true, "SCHOOL_NOT_FOUND"));
                return;
            }
            if (school.status !== "active" || !school.isActive) {
                next(new AppError("This school account is not currently active", 403, true, "SCHOOL_INACTIVE"));
                return;
            }
            if (!school.schemaProvisionedAt) {
                next(new AppError("Your school is still being set up. Try again in a moment.", 503, true, "SCHOOL_SETTING_UP"));
                return;
            }

            target = { tenantSchema: school.schemaName, schoolId: school.id };
        }

        req.tenantSchema = target.tenantSchema;
        req.schoolId     = target.schoolId;

        TenantContext.run({ tenantSchema: target.tenantSchema, schoolId: target.schoolId }, () => next());
    } catch (err) {
        next(err);
    }
};

export const requireTenant = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenantSchema || !req.schoolId || req.schoolId === "PUBLIC") {
        res.status(400).json({
            success: false,
            message: "No school context. Please access via your school subdomain.",
            code:    "NO_SCHOOL_CONTEXT",
        });
        return;
    }
    next();
};

/**
 * Cheap, synchronous check that the token's school matches the resolved school.
 * loadAccess performs the same check; this stays so existing routes keep working.
 * Platform sessions are not allowed inside a school (they use impersonation).
 */
export const validateTenantOwnership = (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next();
    if (!req.schoolId || req.schoolId === "PUBLIC") return next();
    if (req.auth.schoolId !== req.schoolId) { next(new TenantMismatchError()); return; }
    next();
};
