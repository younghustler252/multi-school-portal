/*
|--------------------------------------------------------------------------
| SALARY TRANSFER RULES (pure). The state machine, the reference, and the limits.
|
| States: PENDING -> SENDING -> PROCESSING | SUCCESS | FAILED | UNKNOWN. Only SUCCESS counts as paid, and only a CONFIRMED outcome
| (the provider's answer, its signed webhook, or a verify) can make it so. UNKNOWN is never resent: it is verified.
|--------------------------------------------------------------------------
*/
import { TransferStatus } from "./transfer.entity";

/** Not failed, reversed or cancelled: the payslip already has a transfer, so another must not be made. */
export const LIVE: ReadonlySet<TransferStatus> = new Set<TransferStatus>(["PENDING", "SENDING", "PROCESSING", "UNKNOWN", "SUCCESS"]);
/** In flight at the provider or of unknown outcome: reconciliation looks at these. */
export const UNSETTLED: ReadonlySet<TransferStatus> = new Set<TransferStatus>(["SENDING", "PROCESSING", "UNKNOWN"]);

export type Outcome = "success" | "failed" | "reversed";

/*
| What a confirmed outcome does to a transfer in each state. A late success after a failure IS accepted (the provider's word about money wins),
| and the caller reports it loudly. A failure never undoes a success; only a reversal does.
*/
export function nextStatus(from: TransferStatus, outcome: Outcome): TransferStatus | "SAME" | "REJECT" {
    switch (outcome) {
        case "success":
            if (from === "SUCCESS") return "SAME";
            if (from === "REVERSED" || from === "CANCELLED") return "REJECT";
            return "SUCCESS";                                            // PENDING, SENDING, PROCESSING, UNKNOWN, FAILED (late)
        case "failed":
            if (from === "FAILED") return "SAME";
            if (from === "SUCCESS" || from === "REVERSED" || from === "CANCELLED") return "REJECT";
            return "FAILED";
        case "reversed":
            if (from === "REVERSED") return "SAME";
            if (from === "CANCELLED") return "REJECT";
            return "REVERSED";                                           // from anything but SUCCESS the caller books the success first
    }
}

/* ---------- references ---------- */

/*
| The reference identifies the school as well as the transfer, because the provider's webhook arrives on the platform and must find the
| right school's books: sal-<first 16 hex of the school id>-<12 random hex>-<attempt>. 16 to 50 characters, lower case, as the provider requires.
*/
const schoolKey = (schoolId: string) => schoolId.replace(/-/g, "").toLowerCase().slice(0, 16);

export function buildReference(schoolId: string, randomHex12: string, attempt: number): string {
    return `sal-${schoolKey(schoolId)}-${randomHex12.toLowerCase()}-${attempt}`;
}

/** The school key and attempt inside one of our references, or null for a reference that is not a salary transfer. */
export function parseReference(ref: string): { schoolKey: string; attempt: number } | null {
    const m = /^sal-([0-9a-f]{16})-[0-9a-f]{12}-(\d{1,3})$/.exec(ref);
    return m ? { schoolKey: m[1], attempt: Number(m[2]) } : null;
}

/* ---------- limits ---------- */

export interface LimitProblem { code: "TRANSFER_OVER_LIMIT" | "BATCH_OVER_LIMIT"; message: string; staffId?: string }

/* 0 means no limit. The whole start is refused when any limit is broken, so a batch is never half sent. */
export function checkLimits(amounts: { staffId: string; amountKobo: bigint }[], maxKobo: bigint, batchMaxKobo: bigint): LimitProblem | null {
    if (maxKobo > 0n) {
        const over = amounts.find(a => a.amountKobo > maxKobo);
        if (over) return { code: "TRANSFER_OVER_LIMIT", staffId: over.staffId, message: `A salary of ${over.amountKobo} kobo is above the single transfer limit of ${maxKobo} kobo` };
    }
    const total = amounts.reduce((s, a) => s + a.amountKobo, 0n);
    if (batchMaxKobo > 0n && total > batchMaxKobo) return { code: "BATCH_OVER_LIMIT", message: `These transfers total ${total} kobo, above the batch limit of ${batchMaxKobo} kobo` };
    return null;
}

/* How long an unanswered transfer waits before reconciliation acts on it, in minutes. A provider "not found" before this is not trusted. */
export const SENDING_STALE_MINUTES = 5;
export const PROCESSING_STALE_MINUTES = 10;
export const NOT_FOUND_TRUST_MINUTES = 30;
