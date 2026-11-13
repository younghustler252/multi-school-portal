import { PaymentFilters } from "../domain/payment.entity";

/*
| WHICH PAYMENTS A GUARDIAN'S OWN LIST CONTAINS
|   - every payment they made themselves (any state: they may be waiting for a transfer to be confirmed), and
|   - payments somebody ELSE made that cover one of their linked children, but only once money really moved
|     (CONFIRMED, or REVERSED afterwards). Another person's pending or failed attempts are never shown.
| Filters narrow this list; they never widen it. A student filter for a child who is not theirs matches nothing.
| The payer and branch filters of the staff list are not available here.
*/
const MONEY_MOVED = ["CONFIRMED", "REVERSED"];

export function familyPaymentsWhere(guardianId: string, linkedStudentIds: string[], f: PaymentFilters): Record<string, unknown> {
    if (f.studentId && !linkedStudentIds.includes(f.studentId)) return { id: { in: [] } };   // not their child: nothing

    const forMyChildren = f.studentId ? [f.studentId] : linkedStudentIds;
    const reach: Record<string, unknown>[] = [{ guardianId }];
    if (forMyChildren.length > 0) reach.push({ status: { in: MONEY_MOVED }, allocations: { some: { studentId: { in: forMyChildren } } } });

    return {
        AND: [
            { OR: reach },
            ...(f.studentId ? [{ allocations: { some: { studentId: f.studentId } } }] : []),
            ...(f.status ? [{ status: f.status }] : []),
            ...(f.method ? [{ method: f.method }] : []),
            ...((f.from || f.to) ? [{ paidAt: { ...(f.from && { gte: f.from }), ...(f.to && { lte: f.to }) } }] : []),
        ],
    };
}
