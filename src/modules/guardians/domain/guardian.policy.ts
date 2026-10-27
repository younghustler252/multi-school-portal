import { violatesColumn } from "../../../shared/errors/unique-violation";
export const GUARDIAN_RELATIONS = ["father", "mother", "uncle", "aunt", "grandparent", "sibling", "guardian", "other"] as const;
export type GuardianRelation = typeof GUARDIAN_RELATIONS[number];

/** Emails are compared and stored trimmed and lower-case, so "Mum@x.com" and "mum@x.com" are one guardian. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * True when a database "already exists" error (P2002) came from the one-guardian-per-email rule
 * (index `Guardian_email_lower_key`), not from the primary-guardian or already-linked rules.
 * The adapter reports only the column text (`lower(email`), never the index name, so we look for the column.
 */
export function isGuardianEmailConflict(err: any): boolean {
    if (err?.code !== "P2002") return false;
    return violatesColumn(err, "email") || `${JSON.stringify(err?.meta ?? "")} ${err?.message ?? ""}`.toLowerCase().includes("guardian_email_lower_key");
}
