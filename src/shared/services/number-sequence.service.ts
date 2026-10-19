import { getTenantClient } from "../../infrastructure/database/prisma/prisma.client";

/*
| NUMBER SEQUENCE (per school): counters for employee ids now; admission numbers, invoice and receipt numbers later.
| next("staff.employee_id") returns 1, 2, 3 ... one per call, atomically (two people at once never get the same number).
| Pass the transaction client as the third argument to make the number part of the SAME transaction as the record
| that uses it: if the record fails to save, the number is rolled back too (no gaps).
| `period` restarts a counter (for example the year for yearly numbering); empty = never restarts.
*/
export class NumberSequenceService {
    async next(key: string, period = "", client?: { numberSequence: ReturnType<typeof getTenantClient>["numberSequence"] }): Promise<number> {
        const db = client ?? getTenantClient();
        const row = await db.numberSequence.upsert({
            where:  { key_period: { key, period } },
            update: { nextValue: { increment: 1 } },
            create: { key, period, nextValue: 2 },
            select: { nextValue: true },
        });
        return row.nextValue - 1;
    }
}
