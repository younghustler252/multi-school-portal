// infrastructure/middleware/reestablish-tenant-context.middleware.ts
import { Request, Response, NextFunction } from "express";
import { TenantContext } from "../database/prisma/tenant.context";

export const reestablishTenantContext = (req: Request, res: Response, next: NextFunction): void => {
    if (req.tenantSchema && req.schoolId && req.schoolId !== "PUBLIC") {
        TenantContext.run({ tenantSchema: req.tenantSchema, schoolId: req.schoolId }, () => next());
    } else {
        next();
    }
};