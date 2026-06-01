

// controllers/guardian.Controller.ts
import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { AppError } from "../../../shared/errors/AppError";
import { sendSuccess } from "../../../shared/utils/response";
import { GuardianService } from "../../../services/GuardianService";
import { toObjectId } from "../../../shared/utils/objectId";
import { getParamAsString } from "../../../shared/utils/params";
import { RelationshipType } from "../../../shared/types/Guardian";

export const createGuardian = asyncHandler(async (req: Request, res: Response) => {
	const schoolId = toObjectId(req.auth.tenantId);
	if (!schoolId) throw new AppError("Invalid tenant ID", 400);

	const { firstName, lastName, phone, email, relationship, students } = req.body;

	if (!firstName || !lastName || !relationship) {
		throw new AppError("Missing required fields", 400);
	}

	if (!Object.values(RelationshipType).includes(relationship)) {
		throw new AppError("Invalid relationship type", 400);
	}

	const guardian = await GuardianService.createGuardian({
		school: schoolId,
		firstName,
		lastName,
		phone,
		email,
		relationship,
		students
	});

	sendSuccess(res, guardian, 201, "Guardian created successfully");
});

export const getAllGuardians = asyncHandler(async (req: Request, res: Response) => {
	const schoolId = toObjectId(req.auth.tenantId);
	if (!schoolId) throw new AppError("Invalid tenant ID", 400);

	const page = req.query.page ? Number(req.query.page) : 1;
	const limit = req.query.limit ? Number(req.query.limit) : 20;
	const search = req.query.search as string | undefined;

	const result = await GuardianService.getAllGuardians({
		schoolId,
		page,
		limit,
		search
	});

	sendSuccess(res, result);
});

export const getGuardianById = asyncHandler(async (req: Request, res: Response) => {
	const schoolId = toObjectId(req.auth.tenantId);
	const guardianId = toObjectId(getParamAsString(req.params.id));

	if (!schoolId || !guardianId) {
		throw new AppError("Invalid ID", 400);
	}

	const guardian = await GuardianService.getGuardianById(
		guardianId,
		schoolId
	);

	sendSuccess(res, guardian);
});

export const updateGuardian = asyncHandler(async (req: Request, res: Response) => {
	const schoolId = toObjectId(req.auth.tenantId);
	const guardianId = toObjectId(getParamAsString(req.params.id));

	if (!schoolId || !guardianId) {
		throw new AppError("Invalid ID", 400);
	}

	const updatedGuardian = await GuardianService.updateGuardian(
		guardianId,
		schoolId,
		req.body
	);

	sendSuccess(res, updatedGuardian, 200, "Guardian updated successfully");
});

export const deactivateGuardian = asyncHandler(async (req: Request, res: Response) => {
	const schoolId = toObjectId(req.auth.tenantId);
	const guardianId = toObjectId(getParamAsString(req.params.id));

	if (!schoolId || !guardianId) {
		throw new AppError("Invalid ID", 400);
	}

	const guardian = await GuardianService.deactivateGuardian(
		guardianId,
		schoolId
	);

	sendSuccess(res, guardian, 200, "Guardian deactivated successfully");
});
