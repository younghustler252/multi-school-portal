/*
| PLATFORM USER LIST AND SEARCH (platform.users.manage). Every account on the platform, across all schools.
|   q            part of the email, first name or last name (case-insensitive); two words match first + last name
|   status       active | inactive (deactivated by support) | locked (too many failed sign-ins, lock still running)
|   schoolId     only people who belong to that school
|   platformOnly true = platform staff only, false = school people only
| Newest accounts first. A row never carries the password hash, phone number, sign-in IP or tokens.
*/
export interface PlatformUserFilters { q?: string; status?: "active" | "inactive" | "locked"; schoolId?: string; platformOnly?: boolean }

export function platformUserWhere(f: PlatformUserFilters, now: Date): Record<string, unknown> {
    const and: Record<string, unknown>[] = [];
    const q = f.q?.trim();
    if (q) {
        const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
        // every word must match somewhere (email, first or last name)
        for (const w of words) and.push({ OR: [
            { email:     { contains: w, mode: "insensitive" } },
            { firstName: { contains: w, mode: "insensitive" } },
            { lastName:  { contains: w, mode: "insensitive" } },
        ] });
    }
    if (f.status === "active")   and.push({ isActive: true });
    if (f.status === "inactive") and.push({ isActive: false });
    if (f.status === "locked")   and.push({ isActive: true, lockedUntil: { gt: now } });
    if (f.schoolId)              and.push({ schools: { some: { schoolId: f.schoolId } } });
    if (f.platformOnly === true)  and.push({ platformMember: { isNot: null } });
    if (f.platformOnly === false) and.push({ platformMember: { is: null } });
    return and.length ? { AND: and } : {};
}

export interface PlatformUserRow {
    id: string; email: string; firstName: string | null; lastName: string | null; isActive: boolean; isEmailVerified: boolean;
    lastLoginAt: Date | null; createdAt: Date; lockedUntil: Date | null; schoolCount: number; isPlatformMember: boolean;
}

export const platformUserView = (u: PlatformUserRow, now: Date) => ({
    id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, isActive: u.isActive, isEmailVerified: u.isEmailVerified,
    isLocked: u.isActive && !!u.lockedUntil && u.lockedUntil.getTime() > now.getTime(),
    lastLoginAt: u.lastLoginAt, createdAt: u.createdAt, schoolCount: u.schoolCount, isPlatformMember: u.isPlatformMember,
});
