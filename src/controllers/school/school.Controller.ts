import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { AppError } from "../../utils/AppError";
import School from "../../models/School";
import { sendSuccess } from "../../utils/response";
import { SchoolService } from "../../services/schoolService";


/* ===========================
   Get Current School
=========================== */
export const getMySchool = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new AppError("Unauthorized", 401);

    const school = await SchoolService.getSchoolByTenantId(tenantId);

    sendSuccess(res, school);
});

/* ===========================
   Update School Info (post-onboarding)
=========================== */
export const updateMySchool = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new AppError("Unauthorized", 401);

    const school = await SchoolService.getSchoolByTenantId(tenantId);

    // Only allow safe fields
    const allowedFields = ["address", "contactEmail", "logoUrl", "timezone"] as const;

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            school[field] = req.body[field];
        }
    }

    await school.save();

    sendSuccess(res, school, 200, "School info updated successfully");
});
