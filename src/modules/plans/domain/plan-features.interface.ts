/*
|--------------------------------------------------------------------------
| PLAN FEATURES INTERFACE
| Defines all possible feature flags
| Stored as JSON in Plan.features column
| Add new features here without touching the DB schema
|--------------------------------------------------------------------------
*/

export interface PlanFeatures {
    // ── Communication ─────────────────────────────────────────────────────
    smsNotifications:    boolean;
    emailNotifications:  boolean;

    // ── Academic ──────────────────────────────────────────────────────────
    reportCardPdf:       boolean;
    customGrading:       boolean;
    attendanceTracking:  boolean;
    gradeManagement:     boolean;

    // ── Finance ───────────────────────────────────────────────────────────
    paymentCollection:   boolean;
    feeManagement:       boolean;
    paymentReceipts:     boolean;

    // ── Platform ──────────────────────────────────────────────────────────
    multipleBranches:    boolean;
    prioritySupport:     boolean;
    apiAccess:           boolean;
    customDomain:        boolean;

    // ── Future features (add here as needed, no migration required) ───────
    parentPortal?:       boolean;
    bulkSms?:            boolean;
    advancedReports?:    boolean;
    whatsappNotifications?: boolean;
}

// ── Default features per plan ─────────────────────────────────────────────
export const FREE_FEATURES: PlanFeatures = {
    smsNotifications:    false,
    emailNotifications:  true,
    reportCardPdf:       false,
    customGrading:       false,
    attendanceTracking:  true,
    gradeManagement:     true,
    paymentCollection:   false,
    feeManagement:       false,
    paymentReceipts:     false,
    multipleBranches:    false,
    prioritySupport:     false,
    apiAccess:           false,
    customDomain:        false,
};

export const STARTER_FEATURES: PlanFeatures = {
    ...FREE_FEATURES,
    smsNotifications:    true,
    reportCardPdf:       true,
    paymentCollection:   true,
    feeManagement:       true,
    paymentReceipts:     true,
};

export const STANDARD_FEATURES: PlanFeatures = {
    ...STARTER_FEATURES,
    customGrading:       true,
    emailNotifications:  true,
    bulkSms:             true,
    advancedReports:     true,
};

export const PREMIUM_FEATURES: PlanFeatures = {
    ...STANDARD_FEATURES,
    multipleBranches:    true,
    prioritySupport:     true,
    apiAccess:           true,
    customDomain:        true,
    parentPortal:        true,
    whatsappNotifications: true,
};