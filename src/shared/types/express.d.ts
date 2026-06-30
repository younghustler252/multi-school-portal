import { Role } from "../../generated/prisma";

/*
|--------------------------------------------------------------------------
| EXPRESS REQUEST EXTENSIONS
| Adds custom properties to Express Request object
|--------------------------------------------------------------------------
*/

declare global {
    namespace Express {
        interface Request {
            // Set by auth middleware after JWT verification
            user?: {
                id:       string;
                email:    string;
                role:     Role;
                schoolId: string | null;
            };

            // Set by tenant resolver middleware
            tenantSchema?: string;
            schoolId?:     string;
        }
    }
}

export {};