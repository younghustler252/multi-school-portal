import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { UserRole } from "../types/UserRole";

/**
 * Middleware: Tenant / School isolation
 * Ensures user can only access their own tenant unless SUPER_ADMIN or PLATFORM_ADMIN
 * @param paramName The route param that contains the school/tenant ID (e.g., "schoolId")
 */
export const enforceTenant = (paramName: string) => {
	return (req: Request, res: Response, next: NextFunction) => {

		// -----------------------------
		// 1️⃣ Ensure auth info exists
		// -----------------------------
		if (!req.auth) {
			return res.status(401).json({ message: "Unauthorized: No auth info" });
		}

		const { role, tenantId } = req.auth;

		
		if (role === UserRole.SUPER_ADMIN || role === UserRole.PLATFORM_ADMIN) {
			return next();
		}

		
		const schoolIdParam = req.params[paramName];
		if (!schoolIdParam) {
			return res.status(400).json({ message: "Missing school ID in route params" });
		}

		const tenantIdStr = tenantId;


		if (tenantIdStr !== schoolIdParam) {
			return res.status(403).json({ message: "Forbidden: Cannot access other school's data" });
		}

		
		next();
	};
};

/**
 * Middleware: Ensures tenant context exists in req.auth
 */
export const requireTenantContext = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	if (!req.auth || !req.auth.tenantId) {
		return res.status(403).json({ message: "Tenant context required" });
	}

	next();
};
