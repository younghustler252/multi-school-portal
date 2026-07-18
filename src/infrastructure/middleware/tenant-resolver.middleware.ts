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
        let targetSchema: string | null = null;
        let targetSchoolId: string | null = null;

        if (env.NODE_ENV === "development" && (req.headers["x-tenant-schema"] || req.headers["x-school-id"])) {
            const devSchema   = req.headers["x-tenant-schema"] as string;
            const devSchoolId = req.headers["x-school-id"]     as string;

            const verifiedSchool = await prisma.school.findFirst({
                where: { id: devSchoolId },
                select: { id: true, schemaName: true, status: true, isActive: true }
            });

            if (
                !verifiedSchool || 
                !verifiedSchool.schemaName || 
                verifiedSchool.schemaName.trim() !== devSchema.trim()
            ) {
                res.status(400).json({
                    success: false,
                    message: "Security Violation: The provided tenant schema and school ID combination is invalid or does not exist.",
                });
                return;
            }

            targetSchema = verifiedSchool.schemaName;
            targetSchoolId = verifiedSchool.id;
        }

        if (!targetSchema || !targetSchoolId) {
            const host      = req.headers.host ?? "";
            const parts     = host.split(".");
            const subdomain = parts.length > 2 ? parts[0].toLowerCase() : null;

            if (
                !subdomain          ||
                subdomain === "www" ||
                subdomain === env.ADMIN_SUBDOMAIN
            ) {
                TenantContext.run({ tenantSchema: "public", schoolId: "PUBLIC" }, () => next());
                return;
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

            targetSchema = school.schemaName;
            targetSchoolId = school.id;
        }

        if (req.user && req.user.role !== "super_admin") {
            if (req.user.schoolId !== targetSchoolId) {
                res.status(403).json({
                    success: false,
                    message: "Access Denied: Your account credentials do not match the requested school portal context.",
                });
                return;
            }
        }

        req.tenantSchema = targetSchema;
        req.schoolId     = targetSchoolId;

        TenantContext.run(
            { tenantSchema: targetSchema, schoolId: targetSchoolId },
            () => next(),
        );

    } catch (err) {
        next(err);
    }
};

export const requireTenant = (
    req:  Request,
    res:  Response,
    next: NextFunction,
): void => {
    if (!req.tenantSchema || !req.schoolId || req.schoolId === "PUBLIC") {
        res.status(400).json({
            success: false,
            message: "No school context. Please access via your school subdomain.",
        });
        return;
    }
    next();
};

export const validateTenantOwnership = (
    req:  Request,
    res:  Response,
    next: NextFunction,
): void => {
    if (!req.user) return next();
    if (!req.schoolId || req.schoolId === "PUBLIC") return next();
    if (req.user.role === "super_admin") return next();

    if (req.user.schoolId !== req.schoolId) {
        res.status(403).json({
            success: false,
            message: "Access Denied: Your account credentials do not match this school portal.",
        });
        return;
    }

    next();
};
