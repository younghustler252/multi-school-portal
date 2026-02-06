// controllers/authController.ts
import bcrypt = require("bcryptjs")
import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { Types } from "mongoose";
import {
	SubscriptionPlan,
	SchoolType,
} from "../../types/School";


import { ISchoolDocument } from "../../models/School";
import { UserService } from "../../services/userService";
import { SchoolService } from "../../services/schoolService";
import { resolveTenantFromHost } from "../../utils/tenantResolver";
import { signAccessToken, setRefreshTokenCookie } from "../../utils/jwt";
import { UserRole } from "../../types/UserRole";
import { AppError } from "../../utils/AppError";
import { sendSuccess } from "../../utils/response";


export const registerUser = asyncHandler(async (req: Request, res: Response) => {
	const { email, password, firstName, lastName, schoolName, role } = req.body;

	if (!email || !password || !firstName || !lastName) {
		throw new AppError("Missing required fields", 400);
	}

	const host = req.get("host");
	if (!host) throw new AppError("Invalid request host", 400);

	const tenant = await resolveTenantFromHost(host);

	let user;
	let school: ISchoolDocument;

	if (tenant) {
		// Invitee flow
		school = tenant;

		user = await UserService.createUser({
			email,
			password,
			firstName,
			lastName,
			role: role && Object.values(UserRole).includes(role) ? role : UserRole.STUDENT,
			schoolId: school._id
		});

		if (host !== `${tenant.slug}.schoolportal.com`) {
			throw new AppError("Cannot register from this domain", 403);
		}
	} else {
		// Owner flow for MVP
		if (!schoolName) throw new AppError("School name is required", 400);

		// 1. Create school without owner
		school = await SchoolService.createNewSchool(
			null,
			null, // ownerId optional for MVP
			schoolName,
			SchoolType.PRIVATE,
			SubscriptionPlan.FREE
		);

		// 2. Create user and link to school
		user = await UserService.createUser({
			email,
			password,
			firstName,
			lastName,
			role: UserRole.ADMIN,
			schoolId: school._id
		});

		// 3. Assign first user as school owner
		school.ownerId = user._id;
		school.createdBy = user._id;
		await school.save();
	}

	const accessToken = signAccessToken({
		sub: user._id.toString(),
		tenantId: user.school.toString(),
		role: user.role
	});

	setRefreshTokenCookie(res, user._id.toString(), user.school.toString());

	sendSuccess(
		res,
		{
			accessToken,
			redirectUrl: `https://${school.slug}.schoolportal.com`
		},
		201,
		"Registration successful"
	);
});




export const loginUser = asyncHandler(async (req: Request, res: Response) => {

	// -----------------------------
	// 1️⃣ Validate input
	// -----------------------------
	const { email, password } = req.body;
	if (!email || !password) {
		throw new AppError("Email and password are required", 400);
	}

	// -----------------------------
	// 2️⃣ Resolve tenant (school) from host
	// -----------------------------
	const host = req.get("host") || "";
	const tenant = await resolveTenantFromHost(host);

	if (!tenant) {
		throw new AppError("Tenant (school) not found or inactive", 404);
	}

	if (!tenant.isActive) {
		throw new AppError("Tenant is inactive", 403);
	}

	// -----------------------------
	// 3️⃣ Fetch user by email + tenant
	// -----------------------------
	const user = await UserService.findByEmail(email, tenant._id);
	if (!user) {
		throw new AppError("Invalid email or password", 401);
	}

	// -----------------------------
	// 4️⃣ Check user status
	// -----------------------------
	if (!user.isActive) throw new AppError("User account is inactive", 403);
	if (!user.emailVerified) throw new AppError("Please verify your email before logging in", 403);

	// -----------------------------
	// 5️⃣ Verify password
	// -----------------------------
	const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
	if (!isPasswordValid) throw new AppError("Invalid email or password", 401);

	// -----------------------------
	// 6️⃣ Update last login
	// -----------------------------
	user.lastLogin = new Date();
	await user.save();

	// -----------------------------
	// 7️⃣ Issue JWT
	// -----------------------------
	const accessToken = signAccessToken({
		sub: user._id.toString(),
		tenantId: tenant._id.toString(),
		role: user.role as UserRole,
	});

	// -----------------------------
	// 8️⃣ Set refresh token cookie
	// -----------------------------
	setRefreshTokenCookie(res, user._id.toString(), tenant._id.toString());

	// -----------------------------
	// 9️⃣ Send response
	// -----------------------------
	sendSuccess(
		res,
		{
			accessToken,
			redirectUrl: `https://${tenant.slug}.schoolportal.com`,
		},
		200,
		"Login successful"
	);

});
