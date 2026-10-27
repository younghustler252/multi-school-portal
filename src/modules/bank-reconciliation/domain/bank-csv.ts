/*
|--------------------------------------------------------------------------
| BANK STATEMENT CSV (phase 6): turns the text of a bank's CSV export into signed lines.
|
| Pure: text in, lines and problems out. No database, no clock, no libraries.
|   - The delimiter (comma, semicolon or tab) and the header row are found automatically; a few lines of preamble
|     (account name, period) above the header are fine.
|   - Money is read as naira text and becomes whole kobo with string arithmetic, never floating point.
|   - A line is SIGNED from the school's point of view: money in is positive, money out is negative.
|     Banks show this either as one signed Amount column or as separate Debit (out) and Credit (in) columns.
|   - Dates are day first (05/10/2026), as Nigerian banks print them; 2026-10-05 and 05 Oct 2026 also work.
|   - Rows that are not transactions (opening balance, totals, blank) are skipped silently. A row that looks like a
|     transaction but cannot be read becomes a problem with its row number, and the rest of the file still loads.
|--------------------------------------------------------------------------
*/

export interface ParsedBankLine {
    row:         number;              // row in the file (1 is the first row), for error messages
    date:        string;              // YYYY-MM-DD
    description: string;
    reference:   string | null;
    amountKobo:  bigint;              // + money in, - money out; never zero
    balanceKobo: bigint | null;       // the bank's running balance after this line, when the file has one
}

export interface CsvProblem { row: number; message: string }

export interface ParsedStatement {
    lines:              ParsedBankLine[];   // oldest first, whichever way the file was sorted
    problems:           CsvProblem[];
    missingColumns:     string[];           // set when no header row with a date and an amount could be found
    openingBalanceKobo: bigint | null;      // from the first line's running balance, when present
    closingBalanceKobo: bigint | null;      // from the last line's running balance, when present
}

/* ---------- text pieces ---------- */

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A real calendar day as YYYY-MM-DD, or null. Day first for numbers; 2 digit years are 20xx. */
export function parseBankDate(raw: string): string | null {
    const s = String(raw ?? "").trim().replace(/\s+/g, " ");
    let y: number, m: number, d: number;
    let r: RegExpExecArray | null;
    if ((r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s))) { y = +r[1]; m = +r[2]; d = +r[3]; }
    else if ((r = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})(?: .*)?$/.exec(s))) { d = +r[1]; m = +r[2]; y = r[3].length === 2 ? 2000 + +r[3] : +r[3]; }
    else if ((r = /^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ,]*(\d{2}|\d{4})(?: .*)?$/.exec(s))) {
        d = +r[1]; m = MONTHS.indexOf(r[2].slice(0, 3).toLowerCase()) + 1; y = r[3].length === 2 ? 2000 + +r[3] : +r[3];
        if (m === 0) return null;
    } else return null;
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
}

/*
| Naira text to whole kobo: "1,234.50" -> 123450n. Accepts a naira sign or NGN/N prefix, a leading or trailing minus and
| accounting brackets "(500.00)" as negative. More than two decimals is refused unless the extra digits are zeros.
| Empty, a lone dash or anything unreadable gives null.
*/
export function parseNairaToKobo(raw: string | null | undefined): bigint | null {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim();
    if (s === "" || s === "-") return null;
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    s = s.replace(/[₦\s]/g, "").replace(/^(NGN|N)(?=[\d.,+-])/i, "");
    if (s.startsWith("-")) { negative = !negative; s = s.slice(1); } else if (s.startsWith("+")) s = s.slice(1);
    if (s.endsWith("-")) { negative = !negative; s = s.slice(0, -1); }

    const [intPart, fracRaw = ""] = s.split(".");
    if (s.split(".").length > 2) return null;
    const grouped = /^\d{1,3}(,\d{3})+$/.test(intPart), plain = /^\d+$/.test(intPart);
    if (!(grouped || plain || (intPart === "" && fracRaw !== ""))) return null;
    if (fracRaw !== "" && !/^\d+$/.test(fracRaw)) return null;
    if (fracRaw.length > 2 && !/^0+$/.test(fracRaw.slice(2))) return null;

    const whole = intPart === "" ? 0n : BigInt(intPart.replace(/,/g, ""));
    const kobo = whole * 100n + BigInt((fracRaw + "00").slice(0, 2));
    return negative ? -kobo : kobo;
}

/* ---------- CSV text to rows ---------- */

/** RFC 4180 style: quoted cells may hold the delimiter, line breaks and "" for a quote. Blank rows are kept so row numbers stay true. */
export function splitCsv(text: string, delimiter: string): string[][] {
    const src = text.replace(/^﻿/, "");
    const rows: string[][] = [];
    let row: string[] = [], cell = "", quoted = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (quoted) {
            if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
            else cell += c;
        } else if (c === '"' && cell === "") quoted = true;
        else if (c === delimiter) { row.push(cell); cell = ""; }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && src[i + 1] === "\n") i++;
            row.push(cell); rows.push(row); row = []; cell = "";
        } else cell += c;
    }
    if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
    return rows;
}

/* ---------- header detection ---------- */

const norm = (h: string) => String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADERS = {
    date:        ["transactiondate", "txndate", "trandate", "date", "postingdate", "postdate", "valuedate"],
    description: ["description", "narration", "narrative", "details", "particulars", "transactiondetails", "remarks"],
    reference:   ["reference", "referenceno", "referencenumber", "ref", "refno", "chequeno", "transactionid", "txnid", "transactionreference"],
    debit:       ["debit", "debits", "debitamount", "withdrawal", "withdrawals", "moneyout", "paidout", "dr"],
    credit:      ["credit", "credits", "creditamount", "deposit", "deposits", "moneyin", "paidin", "cr"],
    amount:      ["amount", "transactionamount", "txnamount"],
    balance:     ["balance", "runningbalance", "closingbalance", "availablebalance"],
} as const;

type Field = keyof typeof HEADERS;
type Columns = Record<Field, number>;

function findColumns(header: string[]): Columns {
    const normalised = header.map(norm);
    const cols = {} as Columns;
    for (const field of Object.keys(HEADERS) as Field[]) {
        let found = -1;
        for (const name of HEADERS[field]) { const i = normalised.indexOf(name); if (i >= 0) { found = i; break; } }
        cols[field] = found;
    }
    return cols;
}

const usable = (c: Columns) => c.date >= 0 && (c.amount >= 0 || c.debit >= 0 || c.credit >= 0);

function locateHeader(rows: string[][]): { index: number; cols: Columns } | null {
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
        const cols = findColumns(rows[i]);
        if (usable(cols)) return { index: i, cols };
    }
    return null;
}

/* ---------- the statement ---------- */

const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

export function parseBankCsv(text: string): ParsedStatement {
    const empty: ParsedStatement = {
        lines: [], problems: [], missingColumns: ["date", "amount (or debit and credit)"], openingBalanceKobo: null, closingBalanceKobo: null,
    };

    let rows: string[][] = [], header: { index: number; cols: Columns } | null = null;
    for (const delimiter of [",", ";", "\t"]) {
        rows = splitCsv(text, delimiter);
        header = locateHeader(rows);
        if (header) break;
    }
    if (!header) return empty;

    const { cols } = header;
    const cell = (r: string[], i: number): string => (i >= 0 && i < r.length ? r[i].trim() : "");
    const lines: ParsedBankLine[] = [];
    const problems: CsvProblem[] = [];

    for (let i = header.index + 1; i < rows.length; i++) {
        const r = rows[i], row = i + 1;
        if (r.every(x => x.trim() === "")) continue;

        const dateRaw = cell(r, cols.date);
        // A row with no readable date that is labelled like a summary (totals at the foot of the file) is not a transaction
        if (parseBankDate(dateRaw) === null && /total|brought forward|carried forward|opening|closing|summary|balance/i.test(r.join(" "))) continue;
        const balance = cols.balance >= 0 ? parseNairaToKobo(cell(r, cols.balance)) : null;

        let amount: bigint | null = null;
        if (cols.amount >= 0) amount = parseNairaToKobo(cell(r, cols.amount));
        else {
            const out = parseNairaToKobo(cell(r, cols.debit)), inn = parseNairaToKobo(cell(r, cols.credit));
            const outAbs = out === null ? 0n : (out < 0n ? -out : out), inAbs = inn === null ? 0n : (inn < 0n ? -inn : inn);
            if (outAbs > 0n && inAbs > 0n) { problems.push({ row, message: "Both a debit and a credit are filled in on the same row" }); continue; }
            amount = out === null && inn === null ? null : inAbs - outAbs;
        }

        // Not a transaction: a blank amount (opening balance, brought forward, totals) or a nil amount
        if (amount === null) {
            if (dateRaw === "" || balance !== null) continue;
            problems.push({ row, message: "No amount on this row" });
            continue;
        }
        if (amount === 0n) continue;

        const date = parseBankDate(dateRaw);
        if (!date) {
            problems.push({ row, message: dateRaw === "" ? "There is an amount on this row but no date" : `The date "${dateRaw}" is not understood (use DD/MM/YYYY or YYYY-MM-DD)` });
            continue;
        }

        const reference = cap(cell(r, cols.reference), 100) || null;
        lines.push({ row, date, description: cap(cell(r, cols.description), 500) || reference || "Bank transaction", reference, amountKobo: amount, balanceKobo: balance });
    }

    // A file may list the newest first: put the lines in time order (a stable reversal keeps same-day order meaningful)
    if (lines.length > 1 && lines[0].date > lines[lines.length - 1].date) lines.reverse();

    const first = lines[0], last = lines[lines.length - 1];
    return {
        lines, problems, missingColumns: [],
        openingBalanceKobo: first && first.balanceKobo !== null ? first.balanceKobo - first.amountKobo : null,
        closingBalanceKobo: last && last.balanceKobo !== null ? last.balanceKobo : null,
    };
}
