import { createHash } from "crypto";

/*
| DEDUPLICATION. Uploading the same statement twice, or two statements that overlap by a few days, must not create a bank
| transaction twice. Each line gets a key built from what the bank printed: the day, the amount, the reference and the
| wording. Two genuine identical lines on the same day (two N5,000 deposits with the same narration) are told apart by their
| position among the identical ones in the file, so they keep different keys and neither is dropped.
*/

export interface KeyedLineInput { date: string; amountKobo: bigint; description: string; reference: string | null }

const clean = (s: string | null): string => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/** The lines with a stable dedupeKey each. Same lines in the same order always give the same keys. */
export function withDedupeKeys<T extends KeyedLineInput>(lines: T[]): (T & { dedupeKey: string })[] {
    const seen = new Map<string, number>();
    return lines.map(l => {
        const base = `${l.date}|${l.amountKobo.toString()}|${clean(l.reference)}|${clean(l.description)}`;
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        return { ...l, dedupeKey: sha(`${base}#${n}`) };
    });
}

/** One value for a whole file, so importing the very same file again is recognised at once. */
export const statementFingerprint = (dedupeKeys: string[]): string => sha([...dedupeKeys].sort().join("\n"));
