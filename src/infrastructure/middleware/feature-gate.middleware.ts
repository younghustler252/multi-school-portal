import { Request, Response, NextFunction } from "express";
import { container } from "../../container";
import { FeatureNotAvailableError, PlanLimitError } from "../../shared/errors/domain.errors";
import { EntitlementsService } from "../../foundation/entitlements.service";
import { FEATURE_BY_LEGACY_FLAG, LegacyFlag } from "../../foundation/features.registry";

/*
|--------------------------------------------------------------------------
| FEATURE GATE
| Same signatures as before, now backed by entitlements (plan + school override).
|
|   requireFeature("smsNotifications")   old flag names still work (mapped to notifications.sms)
|   requireFeature("notifications.sms")  new keys work too
|   requirePlanLimit("student")          one more record is about to be created
|   assertWithinPlanLimit(...)           for bulk use cases that add many at once
|--------------------------------------------------------------------------
*/

export type FeatureArg = LegacyFlag | (string & {});

const LIMIT_KEYS = { student: "students.max", staff: "staff.max" } as const;
export type LimitType = keyof typeof LIMIT_KEYS;

const entitlements = () => container.resolve<EntitlementsService>("entitlementsService");
const toKey = (feature: FeatureArg): string => FEATURE_BY_LEGACY_FLAG.get(feature)?.key ?? feature;

// The resolved tenant wins; the token's school is only a fallback.
const schoolIdOf = (req: Request): string | null =>
    req.schoolId && req.schoolId !== "PUBLIC" ? req.schoolId : (req.user?.schoolId ?? null);

const warn = (res: Response, key: string): void => {
    res.locals.entitlementWarnings = [...(res.locals.entitlementWarnings ?? []), key];
};

export const requireFeature = (feature: FeatureArg) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const schoolId = schoolIdOf(req);
            if (!schoolId) { next(new FeatureNotAvailableError(feature)); return; }

            const key      = toKey(feature);
            const decision = await entitlements().checkFeature(schoolId, key);

            if (!decision.allowed) { next(new FeatureNotAvailableError(feature)); return; }
            if (decision.warn) warn(res, key);
            next();
        } catch (err) {
            next(err);
        }
    };
};

export const assertWithinPlanLimit = async (schoolId: string, type: LimitType, adding = 1): Promise<{ warn: boolean }> => {
    const decision = await entitlements().checkLimit(schoolId, LIMIT_KEYS[type], adding);
    if (!decision.allowed) {
        const key = LIMIT_KEYS[type];
        if (decision.reason === "limit_reached") {
            throw new PlanLimitError(
                `You have reached your plan limit of ${decision.limit} ${type}s. Please upgrade your plan.`,
                { key, limit: decision.limit, current: decision.current },
            );
        }
        throw new PlanLimitError(`Your plan does not allow adding ${type}s right now. Please check your subscription.`, { key });
    }
    return { warn: decision.warn === true };
};

export const requirePlanLimit = (type: LimitType, adding = 1) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const schoolId = schoolIdOf(req);
            if (!schoolId) { next(); return; }                    // platform-level requests have no school to limit

            const { warn: warned } = await assertWithinPlanLimit(schoolId, type, adding);
            if (warned) warn(res, LIMIT_KEYS[type]);
            next();
        } catch (err) {
            next(err);
        }
    };
};
