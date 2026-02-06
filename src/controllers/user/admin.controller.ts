import { Request, Response } from "express";
import { Types } from "mongoose";
import asyncHandler from "express-async-handler";
import { AppError } from "../../utils/AppError";
import { sendSuccess } from "../../utils/response";
import { UserService } from "../../services/userService";
import { UserRole } from "../../types/UserRole";
import { getParamAsString } from "../../utils/params";
import { toObjectId } from "../../utils/objectId";



export const getAllUsers = asyncHandler(async(req: Request, res: Response) => {
    const schoolId = toObjectId(req.auth.tenantId);

    if (!schoolId) throw new AppError("Invalid tenant ID", 400);

    // Parse query params
	const role = req.query.role as UserRole | undefined;
	const page = req.query.page ? Number(req.query.page) : 1;
	const limit = req.query.limit ? Number(req.query.limit) : 20;
	const search = req.query.search as string | undefined; 

	// Call service
	const result = await UserService.getAllUsers({
		schoolId,
		role,
		page,
		limit,
		search
	});

	sendSuccess(res, result)
});


export const createUser = asyncHandler(async(req: Request, res: Response) => {
    const{ email, password, firstName, lastName, role } = req.body;

    const schoolId = toObjectId(req.auth.tenantId);
    if (!schoolId) throw new AppError("Invalid tenant ID", 400);

    const user = await UserService.createUser({
        schoolId,
        email,
        password,
        firstName,
        lastName,
        role
    });
    sendSuccess(res, user, 201, "User created successfully");
})

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
    const userId = toObjectId(getParamAsString(req.params.id));
    if (!userId) throw new AppError("Invalid user ID", 400);

    const schoolId = toObjectId(req.auth.tenantId);
    if (!schoolId) throw new AppError("Invalid tenant ID", 400);

    const user = await UserService.getUserById(userId, schoolId);

    sendSuccess(res, user);
});



export const updateUser = asyncHandler(async (req: Request, res: Response) => {
	const userId = toObjectId(getParamAsString(req.params.id));


	const schoolId = toObjectId(req.auth.tenantId);

	// Only allow safe fields to update
	const { firstName, lastName, email, role, phone, profilePicture } = req.body;

	const updatedUser = await UserService.updateUser(userId, {
		firstName,
		lastName,
		email,
		role,
		phone,
		profilePicture
	});

	sendSuccess(res, updatedUser, 200, "User updated successfully");
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
	const userId = toObjectId(getParamAsString(req.params.id));

	await UserService.deleteUser(userId);

	sendSuccess(res, null, 200, "User deleted successfully");
});


export const assignRole = asyncHandler(async (req: Request, res: Response) => {
	const userId = toObjectId(getParamAsString(req.params.id));
	const { role } = req.body;

	if (!role || !Object.values(UserRole).includes(role)) {
		throw new AppError("Invalid role", 400);
	}

	if (role === UserRole.SUPER_ADMIN) {
		throw new AppError("Cannot assign SUPERADMIN role", 403);
	}

	const updatedUser = await UserService.assignRole(userId, role);

	sendSuccess(res, updatedUser, 200, "Role updated successfully");
});


export const getSchoolAnalytics = asyncHandler(async (req: Request, res: Response) => {

	const schoolId = toObjectId(req.auth.tenantId);

	const analytics = await UserService.getSchoolUserAnalytics(schoolId);

	sendSuccess(res, analytics)


});
