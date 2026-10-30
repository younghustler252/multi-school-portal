/*
|--------------------------------------------------------------------------
| FOUNDATION DB (narrow structural interface)
| Only what the registry sync and the backfill need from Prisma.
| The real PrismaClient (public) satisfies this structurally; if TypeScript
| complains about delegate generics, pass `prisma as unknown as FoundationDb`.
| Keeping it narrow lets the logic be tested with an in-memory fake.
|--------------------------------------------------------------------------
*/

export type FeatureKind       = "BOOLEAN" | "LIMIT" | "QUOTA" | "ENUM";
export type Enforcement       = "BLOCK" | "WARN";
export type DefinitionOrigin  = "CODE" | "PLATFORM";

export interface FeatureDefinitionRow {
    key:           string;
    origin:        DefinitionOrigin;
    kind:          FeatureKind;
    module:        string;
    meterKey:      string | null;
    unit:          string | null;
    name:          string;
    description:   string | null;
    enforcement:   Enforcement;
    upsellMessage: string | null;
    isActive:      boolean;
}

export interface PlanRow {
    id:           string;
    name:         string;
    studentLimit: number;
    staffLimit:   number;
    features:     unknown;
}

export interface PlanEntitlementRow {
    planId:     string;
    featureKey: string;
    boolValue:  boolean | null;
    limitValue: number | null;
    enumValue:  string | null;
}

export interface FoundationDb {
    featureDefinition: {
        findMany(): Promise<FeatureDefinitionRow[]>;
        create(args: { data: FeatureDefinitionRow }): Promise<unknown>;
        update(args: { where: { key: string }; data: Partial<FeatureDefinitionRow> }): Promise<unknown>;
    };
    plan: {
        findMany(): Promise<PlanRow[]>;
    };
    planEntitlement: {
        findMany(args: { where: { planId: string } }): Promise<PlanEntitlementRow[]>;
        create(args: { data: PlanEntitlementRow }): Promise<unknown>;
    };
}
