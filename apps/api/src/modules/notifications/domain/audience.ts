import type { Access } from "../../../foundation/access.service";
import { notificationErrors } from "./notification.errors";

/*
| WHO A SCHOOL-WIDE ANNOUNCEMENT REACHES (pure: no database, easy to test).
| An announcement to a group (all parents, all students, all staff, everyone) can be narrowed by BRANCH and, for students
| and their parents, by CLASS (the class they are in this term). Narrowing is an AND: a branch AND a class means students
| of that class who are also in that branch (a class belongs to one branch, so this only makes sense for sanity checks).
|
| notifications.send at ALL scope may reach anyone. At BRANCH scope the sender may reach only students, parents and staff of
| their own branches: the audience is limited to those branches (all of them when none is chosen) and choosing a branch or
| class outside them is refused. Specific people picked by id are limited the same way (refused if any is outside).
*/
export interface AudienceFilter { branchIds?: string[]; classIds?: string[] }

const has = (a?: string[]) => !!a && a.length > 0;

export function studentAudienceWhere(f: AudienceFilter): Record<string, unknown> {
    const and: Record<string, unknown>[] = [];
    if (has(f.branchIds)) and.push({ branchId: { in: f.branchIds } });
    if (has(f.classIds)) and.push({ enrolments: { some: { classId: { in: f.classIds }, status: "active", term: { isCurrent: true } } } });
    return and.length ? { AND: and } : {};
}
/** Parents: linked to at least one student who is in the audience. */
export const guardianAudienceWhere = (f: AudienceFilter): Record<string, unknown> =>
    has(f.branchIds) || has(f.classIds) ? { studentLinks: { some: { student: studentAudienceWhere(f) } } } : {};
export const staffAudienceWhere = (f: AudienceFilter): Record<string, unknown> =>
    has(f.branchIds) ? { branches: { some: { branchId: { in: f.branchIds } } } } : {};

/** Combine a base `where` with an extra one (either may be empty). */
export const both = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
    const parts = [a, b].filter(x => Object.keys(x).length > 0);
    return parts.length === 0 ? {} : parts.length === 1 ? parts[0] : { AND: parts };
};

export interface ScopeResult { filter: AudienceFilter; limited: boolean }

/* Works out what the sender may reach. `classBranch` maps the chosen classes to their branches (only needed at BRANCH scope). */
export function resolveAudience(
    access: Access | undefined, dto: AudienceFilter & { targetType: string },
    classBranch: Map<string, string>,
): ScopeResult {
    const staffOnly = ["STAFF", "ALL_STAFF"].includes(dto.targetType);
    if (has(dto.classIds) && (staffOnly || dto.targetType === "EVERYONE")) throw notificationErrors.classAudienceNotForStaff();
    const scope = access?.scopeOf("notifications.send");
    if (!access || scope === "ALL") return { filter: { branchIds: dto.branchIds, classIds: dto.classIds }, limited: false };

    const allowed = (access.branchScope("notifications.send") as string[] | null) ?? [];
    if (scope !== "BRANCH" || allowed.length === 0) throw notificationErrors.audienceOutOfScope();
    if (has(dto.branchIds) && dto.branchIds!.some(b => !allowed.includes(b))) throw notificationErrors.audienceOutOfScope();
    for (const c of dto.classIds ?? []) { const b = classBranch.get(c); if (!b || !allowed.includes(b)) throw notificationErrors.audienceOutOfScope(); }
    return { filter: { branchIds: has(dto.branchIds) ? dto.branchIds : allowed, classIds: dto.classIds }, limited: true };
}
