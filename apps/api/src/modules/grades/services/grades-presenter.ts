/* Responses carry names, not bare ids. A missing relation is null. */
export interface NameRef { id: string; name: string }
export interface StudentRef { id: string; name: string; admissionNumber: string | null }
export interface TermRef extends NameRef { session: NameRef | null }

export const studentRef = (s: { id: string; firstName: string; lastName: string; admissionNumber: string | null }): StudentRef =>
    ({ id: s.id, name: [s.firstName, s.lastName].filter(Boolean).join(" "), admissionNumber: s.admissionNumber ?? null });

export const termRef = (t: { id: string; name: string; session: { id: string; name: string } | null }): TermRef =>
    ({ id: t.id, name: t.name, session: t.session ? { id: t.session.id, name: t.session.name } : null });

export const staffRef = (s: { id: string; firstName: string; lastName: string }): NameRef =>
    ({ id: s.id, name: [s.firstName, s.lastName].filter(Boolean).join(" ") });
