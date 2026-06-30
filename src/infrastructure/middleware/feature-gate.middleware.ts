import { Request, Response, NextFunction } from "express";
import { prisma }                          from "../database/prisma/prisma.client";
import { FeatureNotAvailableError } from "../../shared/errors/domain.error";
/*
|--------------------------------------------------------------------------
| FEATURE GATE MIDDLEWARE
| Checks if the school's current plan includes a specific feature
| Usage: router.post("/", authenticate, requireFeature("smsNotifications"), handler)
|--------------------------------------------------------------------------
*/

// Map feature names to plan fields
type PlanFeature =
    | "smsNotifications"
    | "reportCardPdf"
    | "paymentCollection"
    | "customGrading"
    | "multipleBranches"
    | "prioritySupport";

export const requireFeature = (feature: PlanFeature) => {
    return async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            if (!req.user?.schoolId) {
                next(new FeatureNotAvailableError(feature));
                return;
            }

            // Get school's active subscription + plan
            const subscription = await prisma.subscription.findFirst({
                where: {
                    schoolId: req.user.schoolId,
                    status:   "active",
                },
                include: {
                    plan: true,
                },
            });

            if (!subscription) {
                next(new FeatureNotAvailableError(feature));
                return;
            }

            const hasFeature = subscription.plan[feature];

            if (!hasFeature) {
                next(new FeatureNotAvailableError(feature));
                return;
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};

/*
|--------------------------------------------------------------------------
| PLAN LIMIT CHECK
| Checks if school has hit their student or staff limit
| Usage: requirePlanLimit("student") before creating a student
|--------------------------------------------------------------------------
*/
type LimitType = "student" | "staff";

export const requirePlanLimit = (type: LimitType) => {
    return async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            if (!req.user?.schoolId) {
                return next();
            }

            const subscription = await prisma.subscription.findFirst({
                where: {
                    schoolId: req.user.schoolId,
                    status:   "active",
                },
                include: {
                    plan: true,
                },
            });

            if (!subscription) return next();

            const limit = type === "student"
                ? subscription.plan.studentLimit
                : subscription.plan.staffLimit;

            // -1 means unlimited
            if (limit === -1) return next();

            // Count current records in tenant schema
            // This uses raw query since we need to check tenant schema
            const tableName = type === "student" ? "students" : "staff";
            const result    = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
                `SELECT COUNT(*) as count FROM "${req.tenantSchema}"."${tableName}"
                 WHERE "isActive" = true`,
            );

            const currentCount = Number(result[0].count);

            if (currentCount >= limit) {
                res.status(403).json({
                    success: false,
                    message: `You have reached your plan limit of ${limit} ${type}s. Please upgrade your plan.`,
                });
                return;
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};