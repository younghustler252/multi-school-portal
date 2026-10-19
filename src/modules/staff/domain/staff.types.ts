import type { Access } from "../../../foundation/access.service";

// Who is acting (always from the verified session, never from the request body)
export interface StaffActor {
    userId:       string;
    membershipId: string | null;
    access:       Access;
    ip:           string;
    userAgent:    string | null;
    isAdmin:      boolean;                       // holds the locked School Admin role
}
