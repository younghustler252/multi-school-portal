import type { Access } from "../../foundation/access.service";

declare global {
    namespace Express {
        interface Request {
            auth?: {
                userId:             string;
                schoolId:           string | null;   // null = platform session
                membershipId:       string | null;
                mustChangePassword: boolean;
                impersonatedBy?:    string;
            };
            /** Who the user is and what they may do (set by loadAccess / any rbac guard). */
            access?: Access;
            tenantSchema?: string;
            schoolId?:     string;
        }
    }
}
export {};