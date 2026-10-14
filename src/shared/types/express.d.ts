import type { Access } from "../../cc/access.service";

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
            /** @deprecated transitional. Read req.auth / req.access instead. `email` was removed (not in the token). */
            user?: { 
                id: string; schoolId: string | null; 
                mustChangePassword: boolean; 
                role: string | null 
            };
            tenantSchema?: string;
            schoolId?:     string;
        }
    }
}
export {};