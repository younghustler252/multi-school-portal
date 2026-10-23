import type { Access } from "../../../foundation/access.service";

// Who is acting. Comes ONLY from the verified session, never from the request body.
export interface GuardianActor {
    userId:       string;
    membershipId: string | null;
    access:       Access;
    ip:           string;
    userAgent:    string | null;
    isAdmin:      boolean;      // holds the locked School Admin role
}

export type GuardianOutcome = "created" | "reused" | "already_linked";
export type InviteStatus    = { status: "sent" | "not_needed" | "failed"; code?: string };
