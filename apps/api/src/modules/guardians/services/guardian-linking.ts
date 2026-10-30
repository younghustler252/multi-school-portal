import { GuardianRelation } from "../domain/guardian.policy";

/*
| The database steps shared by "create guardian" and "link guardian". They take the open transaction (tx) so the
| guardian and the link are saved together or not at all. This file imports nothing from the app, so it can be tested
| with a small fake.
|
| ONE PRIMARY GUARDIAN PER STUDENT: the steps below hand the primary over (the old one stops being primary), and a
| database rule (a partial unique index, migration 20261023150000_guardian_primary_unique) refuses a second primary even
| if two requests arrive in the same moment. The caller turns that refusal (error code P2002) into PRIMARY_GUARDIAN_CONFLICT.
*/
export interface LinkTx {
    guardian:        { findFirst(a: any): Promise<any>; create(a: any): Promise<any> };
    studentGuardian: { findUnique(a: any): Promise<any>; updateMany(a: any): Promise<any>; create(a: any): Promise<any> };
}

export interface LinkInput { guardianId: string; studentId: string; relation: GuardianRelation; isPrimary: boolean }

/** Links a guardian to a student. Returns "already_linked" (and changes nothing) if the link exists. */
export async function linkInTx(tx: LinkTx, p: LinkInput): Promise<"linked" | "already_linked"> {
    const existing = await tx.studentGuardian.findUnique({ where: { studentId_guardianId: { studentId: p.studentId, guardianId: p.guardianId } } });
    if (existing) return "already_linked";
    if (p.isPrimary) await tx.studentGuardian.updateMany({ where: { studentId: p.studentId, isPrimary: true }, data: { isPrimary: false } });
    await tx.studentGuardian.create({ data: { guardianId: p.guardianId, studentId: p.studentId, relation: p.relation, isPrimary: p.isPrimary } });
    return "linked";
}

export interface NewGuardian { firstName: string; lastName: string; email: string; phone?: string; occupation?: string; address?: string }

/**
 * Finds the guardian with this email in THIS school (any capitals) or creates one, then links to the student.
 * An existing guardian is reused as it is: their name, phone and other details are never overwritten.
 */
export async function createOrReuseGuardianInTx(
    tx: LinkTx, guardian: NewGuardian, link: Omit<LinkInput, "guardianId">,
): Promise<{ guardian: any; outcome: "created" | "reused" | "already_linked" }> {
    let g = await tx.guardian.findFirst({ where: { email: { equals: guardian.email, mode: "insensitive" } } });
    const created = !g;
    if (!g) g = await tx.guardian.create({ data: { ...guardian, isActive: true } });

    const result = await linkInTx(tx, { ...link, guardianId: g.id });
    return { guardian: g, outcome: result === "already_linked" ? "already_linked" : created ? "created" : "reused" };
}
