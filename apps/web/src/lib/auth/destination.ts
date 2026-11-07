import type { MyPermissions } from "@schoolos/contracts";
import type { Profile } from "./session-types";

/*
| Where a freshly signed-in user lands (AUTHZ-001). Decided from the SESSION KIND and from PERMISSIONS, never from a role name:
| role names are tenant data (a school can rename or add roles), permissions are the contract.
|
| This is the minimal M1 resolver. Persona/school switching and per-feature landing pages are M2/M3.
*/

export const PLATFORM_HOME = "/dashboard"; // existing super-admin route group
export const SCHOOL_HOME = "/home"; // permission-aware landing introduced in M1

export function resolveDestination(profile: Profile, _permissions: MyPermissions): string {
	return profile.session.kind === "platform" ? PLATFORM_HOME : SCHOOL_HOME;
}

/** Only same-origin relative paths are honoured as "return to" targets (blocks open redirects). */
export function safeReturnTo(value: string | null | undefined): string | null {
	if (!value) return null;
	if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
	return value;
}

