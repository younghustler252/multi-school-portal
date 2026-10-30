import { Role } from "../../../generated/public/client";
import { PersonaType } from "../types/auth.types";

/*
|--------------------------------------------------------------------------
| TRANSITIONAL — delete in the cleanup stage with User.role, Invite.role and Staff.role.
| The legacy role columns are still required by the schema. Authority no longer
| reads them (permissions come from Membership + SchoolRole); these values only
| keep the columns filled sensibly until they are dropped.
|--------------------------------------------------------------------------
*/

const STAFF_KEYS = ["school_admin", "principal", "teacher", "bursar"] as const;

export function legacyUserRole(persona: PersonaType, templateKey?: string | null): Role {
    if (persona === "GUARDIAN") return "guardian" as Role;
    if (persona === "STUDENT")  return "student" as Role;
    return ((STAFF_KEYS as readonly string[]).includes(templateKey ?? "") ? templateKey : "teacher") as Role;
}

export type LegacyStaffRole = "school_admin" | "principal" | "teacher" | "bursar" | "other";

export function legacyStaffRole(templateKey?: string | null): LegacyStaffRole {
    return ((STAFF_KEYS as readonly string[]).includes(templateKey ?? "") ? templateKey : "other") as LegacyStaffRole;
}
