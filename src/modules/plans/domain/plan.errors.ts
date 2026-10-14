import { AppError, NotFoundError, ConflictError } from "../../../shared/errors/domain.errors";

export const planErrors = {
    notFound:        () => new NotFoundError("Plan"),
    nameTaken:       () => new ConflictError("A plan with this name already exists"),
    systemProtected: (what: string) => new AppError(`The built-in Free plan cannot be ${what}`, 409, true, "SYSTEM_PLAN_PROTECTED"),
    hasSubscribers:  (n: number) => new AppError(
        `${n} school(s) are subscribed to this plan. Move them to another plan first`, 409, true, "PLAN_HAS_SUBSCRIBERS", { subscribers: n }),
    badPrice:        (msg: string) => new AppError(msg, 400, true, "INVALID_PRICE"),
    unknownFeature:  (key: string) => new AppError(`Unknown feature "${key}"`, 400, true, "UNKNOWN_FEATURE", { feature: key }),
    badEntitlement:  (key: string, msg: string) => new AppError(`${key}: ${msg}`, 400, true, "INVALID_ENTITLEMENT", { feature: key }),
};
