import { ForbiddenError, UnauthorizedError } from "../shared/errors/domain.errors"

/*
|--------------------------------------------------------------------------
| ACCESS SERVICE
| Loads "who is this, and what may they do" for a session:
|   school session   -> tenant Membership + SchoolRole(s) + SchoolRolePermission + the branches they work in
|   platform session -> PlatformMember + PlatformRole(s) + PlatformRolePermission
|
| Permissions are the union over the member's roles; for each key the widest
| scope wins (ALL > BRANCH > ASSIGNED > OWN). A role with grantsAll holds every
| permission of its realm. Keys starting with "platform." belong to the
| platform realm only; all other keys belong to the school realm only.
| Cached for a short TTL; call invalidate() after any role/membership/branch change.
|
| SCOPES, in plain words
|   ALL       the whole school (every branch)
|   BRANCH    only the branches the person is assigned to
|   ASSIGNED  only the classes/subjects/students assigned to them
|   OWN       only their own record (or, for a guardian, their own children)
|--------------------------------------------------------------------------
*/

export type Scope   = "ALL" | "BRANCH" | "ASSIGNED" | "OWN";
export type Persona = "STAFF" | "STUDENT" | "GUARDIAN";
export type Realm   = "school" | "platform";

const RANK: Record<Scope, number> = { OWN: 1, ASSIGNED: 2, BRANCH: 3, ALL: 4 };
const LEGACY_ROLE_PRIORITY = ["school_admin", "principal", "bursar", "teacher", "student", "guardian"] as const;

/** Is a held scope at least as wide as the needed one? (ALL > BRANCH > ASSIGNED > OWN; a missing scope covers nothing.) */
export const scopeCovers = (held: Scope | null, needed: Scope): boolean => held !== null && RANK[held] >= RANK[needed];

/**
 * May someone who holds these permissions hand out a role with these permissions? Every permission of the role must be held,
 * and held at a scope at least as wide as the role grants it. (Comparing keys alone would let a person with students.view at OWN
 * give away students.view at ALL.) A role that grants everything is a separate rule: only a school admin may give it.
 */
export const canDelegateRole = (granted: ReadonlyArray<{ key: string; scope: Scope }>, scopeOf: (key: string) => Scope | null): boolean =>
    granted.every(p => scopeCovers(scopeOf(p.key), p.scope));

export class Access {
    constructor(
        readonly realm:           Realm,
        readonly userId:          string,
        readonly membershipId:    string,
        readonly persona:         Persona | null,
        readonly personaEntityId: string | null,
        readonly roleKeys:        ReadonlySet<string>,
        private readonly grantsAll:    boolean,
        private readonly permissions:  ReadonlyMap<string, Scope>,
        /** The branches this person is assigned to (school sessions). Only meaningful for BRANCH-scoped permissions. */
        readonly branchIds:       ReadonlySet<string> = new Set(),
    ) {}

    private applies(key: string): boolean {
        return key.startsWith("platform.") === (this.realm === "platform");
    }

    can(key: string): boolean {
        return this.applies(key) && (this.grantsAll || this.permissions.has(key));
    }

    /** ALL / BRANCH / ASSIGNED / OWN, or null when the permission is not held. Use cases apply the scope to their queries. */
    scopeOf(key: string): Scope | null {
        if (!this.applies(key)) return null;
        if (this.grantsAll) return "ALL";
        return this.permissions.get(key) ?? null;
    }

    /**
     * Which branches may this permission act on?
     *   "ALL"        every branch: add no branch filter
     *   string[]     only these branches: filter with  branchId IN (...)
     *   null         the permission is not branch-wide (held at ASSIGNED / OWN scope, or not held): use that scope instead
     */
    branchScope(key: string): "ALL" | string[] | null {
        const scope = this.scopeOf(key);
        if (scope === "ALL") return "ALL";
        if (scope === "BRANCH") return [...this.branchIds];
        return null;
    }

    /** May this permission act on this particular branch? */
    canActInBranch(key: string, branchId: string): boolean {
        const s = this.branchScope(key);
        return s === "ALL" || (Array.isArray(s) && s.includes(branchId));
    }

    hasRoleKey(key: string): boolean {
        return this.roleKeys.has(key);
    }

    /** @deprecated transitional, for controllers that still read req.user.role */
    get legacyRole(): string | null {
        if (this.realm === "platform") return this.roleKeys.has("super_admin") ? "super_admin" : null;
        const fromRole = LEGACY_ROLE_PRIORITY.find((k) => this.roleKeys.has(k));
        if (fromRole) return fromRole;
        if (this.persona === "STUDENT")  return "student";
        if (this.persona === "GUARDIAN") return "guardian";
        return null;
    }
}

// ── Narrow DB interface (the real Prisma clients satisfy it; cast if generics complain) ──
type MemberStatus = "active" | "suspended" | "removed";

export interface MembershipRow {
    id: string; userId: string; persona: Persona; personaEntityId: string; status: MemberStatus;
    roles: Array<{
        role: {
            sourceTemplateKey: string | null; grantsAll: boolean; deletedAt: Date | null;
            permissions: Array<{ permissionKey: string; scope: Scope }>;
        };
    }>;
}

export interface PlatformMemberRow {
    id: string; userId: string; status: MemberStatus;
    roles: Array<{
        role: {
            systemKey: string | null; grantsAll: boolean; isActive: boolean;
            permissions: Array<{ permissionKey: string }>;
        };
    }>;
}

export interface AccessDb {
    tenant(): {
        membership: { findUnique(args: { where: { id: string }; include: Record<string, unknown> }): Promise<MembershipRow | null> };
        staffBranch: { findMany(args: { where: { staffId: string }; select: { branchId: true } }): Promise<Array<{ branchId: string }>> };
    };
    platform: {
        platformMember: { findUnique(args: { where: { id: string }; include: Record<string, unknown> }): Promise<PlatformMemberRow | null> };
    };
}

export interface AccessOptions { ttlMs?: number; now?: () => number }
export interface SessionRef    { realm: Realm; membershipId: string; userId: string }

export class AccessService {
    private readonly ttlMs: number;
    private readonly now:   () => number;
    private readonly cache = new Map<string, { value: Promise<Access>; expires: number }>();

    constructor(private readonly db: AccessDb, opts: AccessOptions = {}) {
        this.ttlMs = opts.ttlMs ?? 15_000;
        this.now   = opts.now   ?? Date.now;
    }

    invalidate(membershipId?: string): void {
        if (!membershipId) { this.cache.clear(); return; }
        this.cache.delete(`school:${membershipId}`);
        this.cache.delete(`platform:${membershipId}`);
    }

    async load(ref: SessionRef): Promise<Access> {
        const key = `${ref.realm}:${ref.membershipId}`;
        const hit = this.cache.get(key);
        let access: Promise<Access>;

        if (hit && hit.expires > this.now()) {
            access = hit.value;
        } else {
            access = ref.realm === "school" ? this.loadSchool(ref.membershipId) : this.loadPlatform(ref.membershipId);
            this.cache.set(key, { value: access, expires: this.now() + this.ttlMs });
            access.catch(() => this.cache.delete(key));                    // never cache a failure
        }

        const loaded = await access;
        if (loaded.userId !== ref.userId) {
            throw new UnauthorizedError("Session is no longer valid", "SESSION_INVALID");
        }
        return loaded;
    }

    private async loadSchool(membershipId: string): Promise<Access> {
        const m = await this.db.tenant().membership.findUnique({
            where:   { id: membershipId },
            include: { roles: { include: { role: { include: { permissions: true } } } } },
        });
        if (!m) throw new UnauthorizedError("Session is no longer valid", "SESSION_INVALID");
        if (m.status !== "active") throw new ForbiddenError("Your account is not active in this school.", "MEMBERSHIP_INACTIVE");

        const roleKeys = new Set<string>();
        const permissions = new Map<string, Scope>();
        let grantsAll = false;

        for (const { role } of m.roles) {
            if (role.deletedAt) continue;
            if (role.sourceTemplateKey) roleKeys.add(role.sourceTemplateKey);
            if (role.grantsAll) grantsAll = true;
            for (const p of role.permissions) {
                const current = permissions.get(p.permissionKey);
                if (!current || RANK[p.scope] > RANK[current]) permissions.set(p.permissionKey, p.scope);
            }
        }

        // Where this person works comes from their STAFF record (one table answers both "where do they work"
        // and "where may their BRANCH-scoped roles act"). Students and guardians have no branches.
        const placed = m.persona === "STAFF"
            ? await this.db.tenant().staffBranch.findMany({ where: { staffId: m.personaEntityId }, select: { branchId: true } })
            : [];
        const branchIds = new Set(placed.map(b => b.branchId));
        return new Access("school", m.userId, m.id, m.persona, m.personaEntityId, roleKeys, grantsAll, permissions, branchIds);
    }

    private async loadPlatform(memberId: string): Promise<Access> {
        const m = await this.db.platform.platformMember.findUnique({
            where:   { id: memberId },
            include: { roles: { include: { role: { include: { permissions: true } } } } },
        });
        if (!m) throw new UnauthorizedError("Session is no longer valid", "SESSION_INVALID");
        if (m.status !== "active") throw new ForbiddenError("Your platform account is not active.", "MEMBERSHIP_INACTIVE");

        const roleKeys = new Set<string>();
        const permissions = new Map<string, Scope>();
        let grantsAll = false;

        for (const { role } of m.roles) {
            if (!role.isActive) continue;
            if (role.systemKey) roleKeys.add(role.systemKey);
            if (role.grantsAll) grantsAll = true;
            for (const p of role.permissions) permissions.set(p.permissionKey, "ALL");
        }

        return new Access("platform", m.userId, m.id, null, null, roleKeys, grantsAll, permissions);
    }
}
