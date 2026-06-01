import { Response, NextFunction, Request } from "express";
import { UserRole } from "../../domain/enums/user-role";
/**
 * Middleware: Role-based authorization
 * @param allowedRoles Array of roles that can access this route
 */
export const authorize = (...allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.auth) {
            return res.status(401).json({ message: "Unauthorized: No auth info" });
        }

        const userRole = req.auth.role;

        // Check if user's role is in the allowed roles
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ message: "Forbidden: Insufficient role" });
        }

        // User has permission, continue
        next();
    };
};
