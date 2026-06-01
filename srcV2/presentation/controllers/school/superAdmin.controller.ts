import { SchoolService } from "../../../services/schoolService";
import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { AppError } from "../../../shared/errors/AppError";
import { sendSuccess } from "../../../shared/utils/response";
import { getParamAsString } from "../../../shared/utils/params";
import { SchoolType } from "../../../shared/types/School";
import { toObjectId } from "../../../shared/utils/objectId";

export const getALLSchool = asyncHandler(async (req: Request, res: Response) => {
    const { page = "1", limit = "20", subscriptionPlan, isActive, verificationStatus } = req.query;

    const filter: any = {};
    if (subscriptionPlan) filter.subscriptionPlan = subscriptionPlan;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (verificationStatus) filter.verificationStatus = verificationStatus;

    const data = await SchoolService.getAllSchools(
        filter,
        parseInt(page as string, 10),
        parseInt(limit as string, 10)
    );

    sendSuccess(res, data);
});

export const getSchoolById = asyncHandler(async (req: Request, res: Response) => {
    const schoolId = getParamAsString(req.params.id);

    const school = await SchoolService.getSchoolById(schoolId);
    sendSuccess(res, school);   
    
});


export const createSchool = asyncHandler(async (req: Request, res: Response) => {
	const { name, schoolType, subscriptionPlan, ownerId } = req.body;

	const superAdminIdObj = toObjectId(req.auth.userId);

	const ownerIdObj = ownerId ? toObjectId(ownerId) : null;

	// Validation
	if (!name) {
		throw new AppError("School name is required", 400);
	}

	if (schoolType && !Object.values(SchoolType).includes(schoolType)) {
		throw new AppError("Invalid school type", 400);
	}

	// Create school
	const school = await SchoolService.createNewSchool(
		ownerIdObj,         // optional owner user
		superAdminIdObj,    // createdBy = super admin
		name,
		schoolType,
		subscriptionPlan
	);

	sendSuccess(res, school, 201, "School created successfully");
});


export const getAllSchoolAnalytics = asyncHandler(async (req: Request, res: Response) => {
	const analytics = await SchoolService.getSchoolAnalytics();
	sendSuccess(res, analytics);
});



