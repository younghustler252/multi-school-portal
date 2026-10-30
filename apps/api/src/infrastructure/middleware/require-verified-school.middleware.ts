import { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma/prisma.client";
import { schoolErrors } from "../../modules/school/domain/school.errors";

/*
|--------------------------------------------------------------------------
| REQUIRE VERIFIED SCHOOL
| A school can sign in and set itself up as soon as its email is confirmed, but risky
| features stay locked until its documents are verified: online payment setup, SMS,
| publishing results. Put this guard on those routes (after authenticate).
|   -> 403 SCHOOL_NOT_VERIFIED, which the frontend turns into a "verify your school" prompt.
| The verification state is cached for 30 seconds per process;
| call invalidateSchoolVerificationCache(schoolId) after it changes.
|--------------------------------------------------------------------------
*/

const TTL_MS = 30_000;
const cache  = new Map<string, { verified: boolean; at: number }>();

export const invalidateSchoolVerificationCache = (schoolId: string): void => { cache.delete(schoolId); };

export const requireVerifiedSchool = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
        const schoolId = req.schoolId && req.schoolId !== "PUBLIC" ? req.schoolId : null;
        if (!schoolId) { next(schoolErrors.notVerified()); return; }

        const hit = cache.get(schoolId);
        if (hit && Date.now() - hit.at < TTL_MS) {
            hit.verified ? next() : next(schoolErrors.notVerified());
            return;
        }

        const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { verificationStatus: true } });
        const verified = school?.verificationStatus === "verified";
        cache.set(schoolId, { verified, at: Date.now() });
        verified ? next() : next(schoolErrors.notVerified());
    } catch (err) {
        next(err);
    }
};
