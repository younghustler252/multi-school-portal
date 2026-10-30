/*
| PLAN ENTITY. Prices only; what a plan INCLUDES lives in PlanEntitlement rows
| (the old studentLimit / staffLimit / features JSON are gone from the domain).
*/
export interface PlanEntity {
    id:               string;
    systemKey:        string | null;   // stable identity of built-in plans ("free"); never changes when a plan is renamed
    name:             string;
    description:      string | null;
    monthlyPriceKobo: number;
    yearlyPriceKobo:  number;
    setupFeeKobo:     number;
    isPublic:         boolean;
    isActive:         boolean;
    isCustom:         boolean;
    createdAt:        Date;
    updatedAt:        Date;
}

// One line of "what this plan includes", ready for a pricing page or the console matrix
export interface PlanEntitlementView {
    key:         string;
    name:        string;
    description: string | null;
    module:      string;
    kind:        "BOOLEAN" | "LIMIT" | "QUOTA" | "ENUM";
    unit:        string | null;
    isActive:    boolean;                  // inactive features are not enforced yet
    granted:     boolean;
    value:       boolean | number | string | null;   // limits: null when unlimited
    unlimited:   boolean;
}
