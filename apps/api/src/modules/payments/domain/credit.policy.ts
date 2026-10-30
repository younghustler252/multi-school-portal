import { CreditRow } from "./payment.entity";

export interface CreditTake { row: CreditRow; takeKobo: bigint }

/* Which credit to use, oldest payment first, until the amount needed is covered or the credit runs out. */
export function planCreditUse(rows: CreditRow[], needKobo: bigint): CreditTake[] {
    const takes: CreditTake[] = [];
    let left = needKobo;
    for (const row of rows) {
        if (left <= 0n) break;
        if (row.availableKobo <= 0n) continue;
        const take = row.availableKobo < left ? row.availableKobo : left;
        takes.push({ row, takeKobo: take });
        left -= take;
    }
    return takes;
}
