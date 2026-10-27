/*
|--------------------------------------------------------------------------
| GATEWAY SETTLEMENT REPORT (phase 6): the CSV the gateway gives for its payouts, matched to our online payments.
|
| Pure. Two steps:
|   parseSettlementCsv  text -> one row per transaction (settlement reference, date, transaction reference, amount, fee)
|   matchSettlements    rows + the payments we know -> one group per settlement, each with matched items and problems
|
| A group is CLEAN only when every row matched one confirmed, unreversed, not yet settled online payment for the same amount
| and no row is duplicated. A clean group can be recorded; anything else is shown to the person and left alone.
| Amounts in the file are naira text; fees are optional (a blank fee means "not stated", so the net column is used when there is one).
|--------------------------------------------------------------------------
*/
import { parseBankDate, parseNairaToKobo, splitCsv } from "../../bank-reconciliation/domain/bank-csv";
import { OnlinePaymentFacts } from "./settlement.entity";

export interface SettlementRow {
    row: number; settlementRef: string; settledOn: string | null; reference: string; amountKobo: bigint; feeKobo: bigint | null;
}
export interface ReportProblem { row: number; message: string }
export interface ParsedSettlementReport { rows: SettlementRow[]; problems: ReportProblem[]; missingColumns: string[] }

const norm = (h: string) => String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const HEADERS = {
    settlementRef: ["settlementid", "settlementreference", "settlementref", "settlementnumber", "batchid", "payoutid", "payoutreference"],
    date:          ["settlementdate", "settledon", "settledat", "payoutdate", "paidat", "date", "transactiondate"],
    reference:     ["reference", "transactionreference", "transactionref", "txnreference", "paymentreference", "ref"],
    amount:        ["amount", "grossamount", "transactionamount", "amountpaid"],
    fee:           ["fee", "fees", "transactionfee", "charges", "gatewayfee"],
    net:           ["net", "netamount", "settledamount", "settlementamount", "amountsettled"],
} as const;
type Field = keyof typeof HEADERS;

function findColumns(header: string[]): Record<Field, number> {
    const n = header.map(norm), out = {} as Record<Field, number>;
    for (const f of Object.keys(HEADERS) as Field[]) {
        let found = -1;
        for (const name of HEADERS[f]) { const i = n.indexOf(name); if (i >= 0) { found = i; break; } }
        out[f] = found;
    }
    return out;
}

/** `fallbackRef` names the settlement when the file has no settlement id column (the whole file is then one settlement). */
export function parseSettlementCsv(text: string, fallbackRef?: string): ParsedSettlementReport {
    let rows: string[][] = [], header = -1, cols = {} as Record<Field, number>;
    for (const delimiter of [",", ";", "\t"]) {
        rows = splitCsv(text, delimiter);
        for (let i = 0; i < Math.min(rows.length, 40); i++) {
            const c = findColumns(rows[i]);
            if (c.reference >= 0 && c.amount >= 0) { header = i; cols = c; break; }
        }
        if (header >= 0) break;
    }
    if (header < 0) return { rows: [], problems: [], missingColumns: ["reference", "amount"] };
    if (cols.settlementRef < 0 && !fallbackRef) return { rows: [], problems: [], missingColumns: ["settlement id (or send settlementReference)"] };

    const cell = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");
    const out: SettlementRow[] = [], problems: ReportProblem[] = [];
    for (let i = header + 1; i < rows.length; i++) {
        const r = rows[i], row = i + 1;
        if (r.every(x => x.trim() === "")) continue;
        const reference = cell(r, cols.reference);
        const amount = parseNairaToKobo(cell(r, cols.amount));
        if (!reference && amount === null) continue;                                  // a blank or summary row
        if (!reference) { problems.push({ row, message: "No transaction reference on this row" }); continue; }
        if (amount === null || amount <= 0n) { problems.push({ row, message: `The amount "${cell(r, cols.amount)}" is not a positive amount` }); continue; }

        let fee: bigint | null = null;
        const feeRaw = cell(r, cols.fee), netRaw = cell(r, cols.net);
        if (feeRaw !== "") {
            const f = parseNairaToKobo(feeRaw);
            if (f === null) { problems.push({ row, message: `The fee "${feeRaw}" is not readable` }); continue; }
            fee = f < 0n ? -f : f;
        } else if (netRaw !== "") {
            const net = parseNairaToKobo(netRaw);
            if (net === null) { problems.push({ row, message: `The net amount "${netRaw}" is not readable` }); continue; }
            fee = amount - net;
        }
        if (fee !== null && (fee < 0n || fee >= amount)) { problems.push({ row, message: "The fee must be between nothing and the amount" }); continue; }

        const settlementRef = cols.settlementRef >= 0 ? cell(r, cols.settlementRef) || fallbackRef || "" : fallbackRef!;
        if (!settlementRef) { problems.push({ row, message: "No settlement id on this row" }); continue; }
        const dateRaw = cell(r, cols.date);
        out.push({ row, settlementRef, settledOn: dateRaw ? parseBankDate(dateRaw) : null, reference, amountKobo: amount, feeKobo: fee });
    }
    return { rows: out, problems, missingColumns: [] };
}

/* ---------- matching ---------- */

export type ProblemKind = "NOT_FOUND" | "ALREADY_SETTLED" | "NOT_CONFIRMED" | "REVERSED" | "AMOUNT_DIFFERS" | "DUPLICATE_IN_FILE" | "FEE_MISSING";

export interface MatchedItem { paymentId: string; reference: string; amountKobo: bigint; feeKobo: bigint; payerName: string | null }
export interface SettlementGroup {
    settlementRef: string; settledOn: string | null;
    items: MatchedItem[]; problems: { row: number; reference: string; kind: ProblemKind; message: string }[];
    grossKobo: bigint; feeKobo: bigint; netKobo: bigint; clean: boolean;
}

export function matchSettlements(rows: SettlementRow[], payments: OnlinePaymentFacts[]): SettlementGroup[] {
    const byRef = new Map<string, OnlinePaymentFacts>();
    for (const p of payments) { if (p.reference) byRef.set(p.reference, p); if (p.gatewayReference && !byRef.has(p.gatewayReference)) byRef.set(p.gatewayReference, p); }

    const groups = new Map<string, SettlementGroup>();
    const seen = new Set<string>();
    for (const r of rows) {
        let g = groups.get(r.settlementRef);
        if (!g) { g = { settlementRef: r.settlementRef, settledOn: r.settledOn, items: [], problems: [], grossKobo: 0n, feeKobo: 0n, netKobo: 0n, clean: true }; groups.set(r.settlementRef, g); }
        if (!g.settledOn && r.settledOn) g.settledOn = r.settledOn;
        const bad = (kind: ProblemKind, message: string) => g!.problems.push({ row: r.row, reference: r.reference, kind, message });

        if (seen.has(r.reference)) { bad("DUPLICATE_IN_FILE", "This transaction appears more than once in the file"); continue; }
        seen.add(r.reference);
        const p = byRef.get(r.reference);
        if (!p) { bad("NOT_FOUND", "No online payment with this reference"); continue; }
        if (p.reversed) { bad("REVERSED", "This payment was reversed"); continue; }
        if (p.status !== "CONFIRMED") { bad("NOT_CONFIRMED", "This payment is not confirmed yet"); continue; }
        if (p.settled) { bad("ALREADY_SETTLED", "This payment was already settled"); continue; }
        if (p.amountKobo !== r.amountKobo) { bad("AMOUNT_DIFFERS", `The report says ${r.amountKobo} kobo, the payment is ${p.amountKobo} kobo`); continue; }
        if (r.feeKobo === null) { bad("FEE_MISSING", "The report gives neither a fee nor a net amount for this transaction"); continue; }
        g.items.push({ paymentId: p.id, reference: r.reference, amountKobo: p.amountKobo, feeKobo: r.feeKobo, payerName: p.payerName });
    }
    for (const g of groups.values()) {
        g.grossKobo = g.items.reduce((s, i) => s + i.amountKobo, 0n);
        g.feeKobo = g.items.reduce((s, i) => s + i.feeKobo, 0n);
        g.netKobo = g.grossKobo - g.feeKobo;
        g.clean = g.problems.length === 0 && g.items.length > 0 && g.feeKobo < g.grossKobo;
    }
    return [...groups.values()];
}
