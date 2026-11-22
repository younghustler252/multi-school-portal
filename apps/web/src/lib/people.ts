/*
| Presentation-neutral helpers about people. Pure: no React, no browser APIs, no imports, so they can be reused by any
| client (a future native app included) and are tested on their own.
*/

export interface PersonName {
	firstName?: string | null;
	lastName?: string | null;
}

/** "Ada Obi". Empty parts are skipped; returns `fallback` when there is no name at all. */
export function fullName(person: PersonName, fallback = ""): string {
	const name = [person.firstName, person.lastName]
		.map((part) => part?.trim())
		.filter((part): part is string => Boolean(part))
		.join(" ");
	return name || fallback;
}

const firstLetter = (text: string | null | undefined): string => {
	const first = Array.from(text?.trim() ?? "")[0];
	return first ? first.toLocaleUpperCase() : "";
};

/**
 * Up to two capital letters for an initials avatar: first letter of the first name and of the last name.
 * With only one of them, that one letter. With neither, the first letter of `fallbackText` (an email, say), else "?".
 */
export function initialsOf(person: PersonName, fallbackText?: string | null): string {
	const letters = firstLetter(person.firstName) + firstLetter(person.lastName);
	return letters || firstLetter(fallbackText) || "?";
}

/** The three persona values the API sends (same strings as `PersonaType` in the shared contract). */
export type PersonaKey = "STAFF" | "GUARDIAN" | "STUDENT";

const PERSONA_LABEL: Record<PersonaKey, string> = {
	STAFF: "Staff",
	GUARDIAN: "Guardian",
	STUDENT: "Student",
};

/** Human label for the kind of session: a school persona, or "Platform admin" for a platform session. */
export function sessionLabel(realm: "school" | "platform", persona: PersonaKey | null | undefined): string {
	if (realm === "platform") return "Platform admin";
	return persona ? PERSONA_LABEL[persona] : "Member";
}
