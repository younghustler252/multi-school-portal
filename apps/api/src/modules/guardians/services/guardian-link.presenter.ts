/* Link responses carry names, not bare ids, so the screen can show them straight away. */

export interface GuardianRef { id: string; name: string }
export interface StudentRef  { id: string; name: string; admissionNumber: string | null }

export interface GuardianLinkData { guardian: GuardianRef; student: StudentRef; relation: string; isPrimary: boolean }

const fullName = (first: string, last: string) => `${first} ${last}`.trim();

export const guardianRef = (g: { id: string; firstName: string; lastName: string }): GuardianRef =>
    ({ id: g.id, name: fullName(g.firstName, g.lastName) });

export const studentRef = (s: { id: string; firstName: string; lastName: string; admissionNumber: string | null }): StudentRef =>
    ({ id: s.id, name: fullName(s.firstName, s.lastName), admissionNumber: s.admissionNumber ?? null });

export const linkData = (
    g: { id: string; firstName: string; lastName: string },
    s: { id: string; firstName: string; lastName: string; admissionNumber: string | null },
    link: { relation: string; isPrimary: boolean },
): GuardianLinkData => ({ guardian: guardianRef(g), student: studentRef(s), relation: link.relation, isPrimary: link.isPrimary });
