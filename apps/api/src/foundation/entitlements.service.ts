import type { Enforcement, FeatureKind } from "./foundation.db";

/*
|--------------------------------------------------------------------------
| ENTITLEMENTS SERVICE
| Effective entitlements for a school = unexpired school override, else the
| plan's entitlement, else not granted. Pure decisions: it never throws
| HTTP errors, the middleware turns a denied decision into an error.
|
| Subscriptions in trialing / active / past_due keep their entitlements.
| (Degrading features while past_due is added in the Billing pass.)
|--------------------------------------------------------------------------
*/

export const ENTITLED_STATUSES = ["trialing", "active", "past_due"] as const;

export interface EntitlementDefRow {
    key:         string;
    kind:        FeatureKind;
    meterKey:    string | null;
    enforcement: Enforcement;
    isActive:    boolean;
}

export interface EntitlementValueRow {
    featureKey: string;
    boolValue:  boolean | null;
    limitValue: number | null;
    enumValue:  string | null;
}

export interface OverrideRow extends EntitlementValueRow {
    expiresAt: Date | null;
}

export interface EntitlementsDb {
    subscription: {
        findFirst(args: {
            where:   { schoolId: string; status: { in: string[] } };
            orderBy: { currentPeriodEnd: "desc" };
        }): Promise<{ planId: string; status: string } | null>;
    };
    planEntitlement: {
        findMany(args: { where: { planId: string } }): Promise<EntitlementValueRow[]>;
    };
    schoolEntitlementOverride: {
        findMany(args: { where: { schoolId: string } }): Promise<OverrideRow[]>;
    };
    featureDefinition: {
        findMany(): Promise<EntitlementDefRow[]>;
    };
}

export type Meter = () => Promise<number>;

export interface EntitlementsOptions {
    ttlMs?:  number;                      // cache lifetime, default 30s
    now?:    () => number;                // injectable clock for tests
    meters?: Record<string, Meter>;       // meterKey -> current usage
}

export type Decision =
    | { allowed: true;  warn?: boolean }
    | { allowed: false; reason: "unknown_feature" | "no_subscription" | "not_granted" | "limit_reached"; limit?: number; current?: number };

interface Value { bool: boolean | null; limit: number | null; enumValue: string | null; source: "plan" | "override" }
interface Resolved { planId: string | null; status: string | null; values: Map<string, Value> }
interface Entry<T> { value: T; expires: number }

export class EntitlementsService {
    private readonly ttlMs:  number;
    private readonly now:    () => number;
    private readonly meters: Record<string, Meter>;
    private readonly schools = new Map<string, Entry<Promise<Resolved>>>();
    private defs: Entry<Promise<Map<string, EntitlementDefRow>>> | null = null;

    constructor(private readonly db: EntitlementsDb, opts: EntitlementsOptions = {}) {
        this.ttlMs  = opts.ttlMs ?? 30_000;
        this.now    = opts.now   ?? Date.now;
        this.meters = opts.meters ?? {};
    }

    /** Drop cached values (call after a plan, override or definition changes). */
    invalidate(schoolId?: string): void {
        if (schoolId) this.schools.delete(schoolId);
        else { this.schools.clear(); this.defs = null; }
    }

    async checkFeature(schoolId: string, key: string): Promise<Decision> {
        const def = (await this.getDefs()).get(key);
        if (!def)          return { allowed: false, reason: "unknown_feature" };
        if (!def.isActive) return { allowed: true };                       // defined but not enforced yet

        const resolved = await this.getForSchool(schoolId);
        if (!resolved.planId) return { allowed: false, reason: "no_subscription" };

        if (this.isGranted(def, resolved.values.get(key))) return { allowed: true };
        return def.enforcement === "WARN" ? { allowed: true, warn: true } : { allowed: false, reason: "not_granted" };
    }

    /** `adding` is how many records the caller is about to create (bulk imports pass the batch size). */
    async checkLimit(schoolId: string, key: string, adding = 1): Promise<Decision> {
        const def = (await this.getDefs()).get(key);
        if (!def || (def.kind !== "LIMIT" && def.kind !== "QUOTA")) return { allowed: false, reason: "unknown_feature" };
        if (!def.isActive) return { allowed: true };

        const resolved = await this.getForSchool(schoolId);
        if (!resolved.planId) return { allowed: false, reason: "no_subscription" };

        const value = resolved.values.get(key);
        const limit = value ? value.limit : 0;                              // no row = not granted = limit 0
        if (limit === null) return { allowed: true };                       // unlimited

        const meter = def.meterKey ? this.meters[def.meterKey] : undefined;
        if (!meter) throw new Error(`No meter registered for "${key}" (meterKey: ${def.meterKey ?? "none"})`);

        const current = await meter();
        if (current + adding <= limit) return { allowed: true };
        if (def.enforcement === "WARN") return { allowed: true, warn: true };
        return { allowed: false, reason: "limit_reached", limit, current };
    }

    async getForSchool(schoolId: string): Promise<Resolved> {
        const hit = this.schools.get(schoolId);
        if (hit && hit.expires > this.now()) return hit.value;
        const value = this.load(schoolId);
        this.schools.set(schoolId, { value, expires: this.now() + this.ttlMs });
        value.catch(() => this.schools.delete(schoolId));                   // never cache a failure
        return value;
    }

    private async getDefs(): Promise<Map<string, EntitlementDefRow>> {
        if (this.defs && this.defs.expires > this.now()) return this.defs.value;
        const value = this.db.featureDefinition.findMany().then((rows) => new Map(rows.map((r) => [r.key, r])));
        this.defs = { value, expires: this.now() + this.ttlMs };
        value.catch(() => { this.defs = null; });
        return value;
    }

    private async load(schoolId: string): Promise<Resolved> {
        const sub = await this.db.subscription.findFirst({
            where:   { schoolId, status: { in: [...ENTITLED_STATUSES] } },
            orderBy: { currentPeriodEnd: "desc" },
        });
        if (!sub) return { planId: null, status: null, values: new Map() };

        const [planRows, overrideRows] = await Promise.all([
            this.db.planEntitlement.findMany({ where: { planId: sub.planId } }),
            this.db.schoolEntitlementOverride.findMany({ where: { schoolId } }),
        ]);

        const values = new Map<string, Value>();
        for (const r of planRows) values.set(r.featureKey, { bool: r.boolValue, limit: r.limitValue, enumValue: r.enumValue, source: "plan" });

        const nowMs = this.now();
        for (const o of overrideRows) {
            if (o.expiresAt && o.expiresAt.getTime() <= nowMs) continue;    // expired override
            values.set(o.featureKey, { bool: o.boolValue, limit: o.limitValue, enumValue: o.enumValue, source: "override" });
        }

        return { planId: sub.planId, status: sub.status, values };
    }

    private isGranted(def: EntitlementDefRow, v: Value | undefined): boolean {
        if (!v) return false;
        switch (def.kind) {
            case "BOOLEAN": return v.bool === true;
            case "ENUM":    return v.enumValue !== null;
            default:        return v.limit === null || v.limit > 0;         // LIMIT / QUOTA used as a yes/no
        }
    }
}
