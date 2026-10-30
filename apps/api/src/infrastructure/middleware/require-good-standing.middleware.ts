import { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma/prisma.client";
import { AppError } from "../../shared/errors/domain.errors";

/*
|--------------------------------------------------------------------------
| REQUIRE GOOD STANDING
| A school with an unpaid, overdue subscription invoice keeps its plan, its features, its fee collection and its
| parent access until the grace period ends ("degrade, do not lock out"). Put this guard ONLY on actions that add
| to what the school does, not on anything people depend on every day: admitting new students (enrolment) and
| entering scores. The records modules apply it when they are converted.
|   -> 403 PAYMENT_OVERDUE, which the frontend turns into a "pay your invoice" prompt.
| The answer is cached for 30 seconds per process.
|--------------------------------------------------------------------------
*/
const TTL_MS = 30_000;
const cache = new Map<string, { overdue: boolean; at: number }>();

export const invalidateGoodStandingCache = (schoolId: string): void => { cache.delete(schoolId); };

export const requireGoodStanding = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
        const schoolId = req.schoolId && req.schoolId !== "PUBLIC" ? req.schoolId : null;
        if (!schoolId) { next(); return; }

        const hit = cache.get(schoolId);
        let overdue: boolean;
        if (hit && Date.now() - hit.at < TTL_MS) overdue = hit.overdue;
        else {
            overdue = (await prisma.subscriptionInvoice.count({ where: { schoolId, status: "open", reason: "renewal", dueDate: { lt: new Date() } } })) > 0;
            cache.set(schoolId, { overdue, at: Date.now() });
        }
        if (overdue) {
            next(new AppError("Your subscription payment is overdue. Pay your invoice to continue", 403, true, "PAYMENT_OVERDUE"));
            return;
        }
        next();
    } catch (err) {
        next(err);
    }
};
