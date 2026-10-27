export const GUARDIAN_RELATIONS = ["father", "mother", "uncle", "aunt", "grandparent", "sibling", "guardian", "other"] as const;
export type GuardianRelation = typeof GUARDIAN_RELATIONS[number];

/** Emails are compared and stored trimmed and lower-case, so "Mum@x.com" and "mum@x.com" are one guardian. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * True when a database "already exists" error (P2002) came from the one-guardian-per-email rule
 * (index `Guardian_email_lower_key`), not from the primary-guardian or already-linked rules.
 */
export function isGuardianEmailConflict(err: any): boolean {
    if (err?.code !== "P2002") return false;
    const where = `${JSON.stringify(err?.meta?.target ?? "")} ${err?.meta?.constraint ?? ""} ${err?.message ?? ""}`.toLowerCase();
    return where.includes("guardian_email_lower_key") || /["\[,]email["\],]/.test(where) && !where.includes("studentguardian");
}
