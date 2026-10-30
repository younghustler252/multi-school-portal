/*
| SEATS IN A CLASS. A class has a limit (capacity) or none. Counting the students and adding them must happen as one
| step, or two requests at the same moment could both take the last seat. `lockClass` writes to the class row, which
| makes the database make the second request wait until the first one has finished.
*/
export interface SeatTx {
    class:     { update(a: any): Promise<any> };
    enrolment: { count(a: any): Promise<number> };
}

export async function lockClass(tx: SeatTx, classId: string): Promise<void> {
    await tx.class.update({ where: { id: classId }, data: { updatedAt: new Date() } });
}

export const activeInClass = (tx: SeatTx, classId: string, termId: string): Promise<number> =>
    tx.enrolment.count({ where: { classId, termId, status: "active" } });

/** True when adding `incoming` students would go past the limit. A class with no limit is never full. */
export const wouldOverflow = (capacity: number | null | undefined, enrolled: number, incoming: number): boolean =>
    !!capacity && enrolled + incoming > capacity;
