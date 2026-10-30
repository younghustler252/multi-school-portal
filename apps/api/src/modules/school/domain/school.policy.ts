/*
|--------------------------------------------------------------------------
| SCHOOL POLICY — the rules of the school lifecycle, in one place
|
| LIFECYCLE
|  1. register           school row reserved, status "pending" (subdomain held, no schema yet)
|  2. email confirmed    status "active": the school is built right away and the admin can sign in.
|                        verificationStatus stays "unverified": risky features stay locked
|                        (online payments, SMS, publishing results) until documents are verified.
|  3. documents          unverified -> under_review -> verified (or rejected, then they can re-upload)
|  4. abandoned?         never verified within the trial window -> suspended (read-only lock),
|                        then released (subdomain freed) after the retention window if it holds no data.
| The three windows below are DEFAULTS; the live values come from PlatformSettings.
|--------------------------------------------------------------------------
*/

export const DEFAULT_UNCONFIRMED_REGISTRATION_HOURS = 72;
export const DEFAULT_UNVERIFIED_TRIAL_DAYS          = 30;
export const DEFAULT_UNVERIFIED_RETENTION_DAYS      = 60;
export const TRIAL_REMINDER_DAYS                    = [7, 1] as const;
export const PROVISIONING_STUCK_MINUTES             = 10;

export const SUSPENSION_VERIFICATION_EXPIRED = "verification_expired";

export const SYSTEM_ACTOR_ID = "SYSTEM_AUTO_VERIFICATION";

// Documents that must be approved before a school becomes verified
export const REQUIRED_DOCS_BY_OWNERSHIP: Record<string, string[]> = {
    private:       ["proprietor_id", "cac_certificate"],
    international: ["proprietor_id", "cac_certificate"],
    mission:       ["proprietor_id", "cac_certificate"],
    public:        ["proprietor_id", "ministry_approval"],
};

export const requiredDocsFor = (ownership: string): string[] =>
    REQUIRED_DOCS_BY_OWNERSHIP[ownership] ?? ["proprietor_id"];

export const MAX_DOCUMENTS_PER_TYPE = 3;

// What the outside world (login screen, frontend) is told about a school
export type SchoolState = "active" | "setting_up" | "suspended" | "unavailable";

export function schoolState(s: { status: string; isActive: boolean; schemaProvisionedAt: Date | null }): SchoolState {
    if (s.status === "suspended") return "suspended";
    if (s.status === "active" && s.isActive) return s.schemaProvisionedAt ? "active" : "setting_up";
    return "unavailable";
}

export const isVerified = (s: { verificationStatus: string }): boolean => s.verificationStatus === "verified";
