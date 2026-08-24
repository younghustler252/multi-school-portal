import { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma/prisma.client";
import { getTenantClient } from "../database/prisma/prisma.client";
import { FeatureNotAvailableError, PlanLimitError } from "../../shared/errors/domain.errors";
import { PlanFeatures } from "../../modules/plans/domain/plan-features.interface";

type PlanFeatureKey = keyof PlanFeatures;

export const requireFeature = (feature: PlanFeatureKey) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

type LimitType = "student" | "staff";

export const requirePlanLimit = (type: LimitType) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

            if (limit === -1) return next();

            const tenantDb = getTenantClient();
            const currentCount = type === "student"
                ? await tenantDb.student.count({ where: { isActive: true } })
                : await tenantDb.staff.count({ where: { isActive: true } });

           if (currentCount >= limit) {
                throw new PlanLimitError(
                    `You have reached your plan limit of ${limit} ${type}s. Please upgrade your plan.`,
                );
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};