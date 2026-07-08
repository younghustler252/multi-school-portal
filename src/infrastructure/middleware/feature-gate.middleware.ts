// src/infrastructure/middleware/feature-gate.middleware.ts

import { Request, Response, NextFunction } from "express";
import { prisma }                          from "../database/prisma/prisma.client";
import { FeatureNotAvailableError }        from "../../shared/errors/domain.errors";
import { PlanFeatures }                    from "../../modules/plans/domain/plan-features.interface";

/*
|--------------------------------------------------------------------------
| FEATURE GATE MIDDLEWARE
| Checks if school's current plan includes a specific feature
| Usage: requireFeature("smsNotifications")
|--------------------------------------------------------------------------
*/

type PlanFeatureKey = keyof PlanFeatures;

export const requireFeature = (feature: PlanFeatureKey) => {
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

            const subscription = await prisma.subscription.findFirst({
                where: {
                    schoolId: req.user.schoolId,
                    status:   { in: ["active", "trialing"] },
                },
                include: { plan: true },
            });

            if (!subscription) {
                next(new FeatureNotAvailableError(feature));
                return;
            }

            // Parse features from JSON
            const features = subscription.plan.features as unknown as PlanFeatures;
            const hasFeature = features[feature];

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
            if (!req.user?.schoolId) return next();

            const subscription = await prisma.subscription.findFirst({
                where: {
                    schoolId: req.user.schoolId,
                    status:   { in: ["active", "trialing"] },
                },
                include: { plan: true },
            });

            if (!subscription) return next();

            const limit = type === "student"
                ? subscription.plan.studentLimit
                : subscription.plan.staffLimit;

            // -1 means unlimited
            if (limit === -1) return next();

            const tableName = type === "student" ? "Student" : "Staff";
            const result    = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
                `SELECT COUNT(*) as count
                 FROM "${req.tenantSchema}"."${tableName}"
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