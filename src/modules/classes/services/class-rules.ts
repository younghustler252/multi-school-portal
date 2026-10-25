/*
| PURE CLASS RULES (no database, easy to test) plus the in-use check.
*/

/** Follows the "promoted into" chain from `toId`; true if it comes back round to `fromId`. */
export async function findProgressionLoop(
    fromId: string, toId: string, nextOf: (classId: string) => Promise<string | null>, nameOf: (id: string) => string,
): Promise<string | null> {
    const chain = [nameOf(fromId), nameOf(toId)];
    const seen = new Set<string>([fromId]);
    let cursor: string | null = toId;
    for (let i = 0; i < 100 && cursor; i++) {
        if (seen.has(cursor)) return chain.join(" → ");
        seen.add(cursor);
        cursor = await nextOf(cursor);
        if (cursor) chain.push(nameOf(cursor));
    }
    return null;
}

export interface UsageTx {
    enrolment:        { count(a: any): Promise<number> };
    classSubject:     { count(a: any): Promise<number> };
    feeStructure:     { count(a: any): Promise<number> };
    feeInvoice:       { count(a: any): Promise<number> };
    classProgression: { count(a: any): Promise<number> };
}

/** What still points at a class. Anything above zero means the class cannot be deleted. */
export async function classUsage(tx: UsageTx, classId: string): Promise<Record<string, number>> {
    const [enrolments, subjectAssignments, feeStructures, invoices, promotionsInto] = await Promise.all([
        tx.enrolment.count({ where: { classId } }),
        tx.classSubject.count({ where: { classId } }),
        tx.feeStructure.count({ where: { classId } }),
        tx.feeInvoice.count({ where: { classId } }),
        tx.classProgression.count({ where: { toClassId: classId } }),
    ]);
    const all = { enrolments, subjectAssignments, feeStructures, invoices, promotionsInto };
    return Object.fromEntries(Object.entries(all).filter(([, n]) => n > 0));
}
