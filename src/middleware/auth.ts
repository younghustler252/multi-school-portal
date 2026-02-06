import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";
import { UserRole } from "../types/UserRole";

/**
 * Middleware: Protect routes by verifying JWT access token
 */
export const protect = (
	req: Request,
	res: Response,
	next: NextFunction
) => {

	// -----------------------------
	// 1️⃣ Read the Authorization header
	// -----------------------------
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return next(new AppError("Missing or invalid token", 401));
	}

	const token = authHeader.split(" ")[1]; // Get the actual token string

	try {

		// -----------------------------
		// 2️⃣ Verify JWT
		// -----------------------------
		const payload = verifyAccessToken(token) as {
			sub: string;
			tenantId: string;
			role: UserRole;
		};

		// -----------------------------
		// 3️⃣ Attach auth info to request
		// -----------------------------
		req.auth = {
			userId: payload.sub,
			tenantId: payload.tenantId,
			role: payload.role
		};

		// -----------------------------
		// 4️⃣ Proceed to next middleware
		// -----------------------------
		next();

	} catch (err) {
		return next(new AppError("Invalid or expired token", 401));
	}
};
