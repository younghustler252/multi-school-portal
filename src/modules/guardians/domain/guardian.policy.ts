export const GUARDIAN_RELATIONS = ["father", "mother", "uncle", "aunt", "grandparent", "sibling", "guardian", "other"] as const;
export type GuardianRelation = typeof GUARDIAN_RELATIONS[number];

/** Emails are compared and stored trimmed and lower-case, so "Mum@x.com" and "mum@x.com" are one guardian. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
