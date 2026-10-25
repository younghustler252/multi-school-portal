import { ReportResult, Cell, ReportColumn } from "./report.types";

/* Kobo to naira with two decimals, from a number or a digit string: 1234500 -> "12345.00". Works for any size. */
export function nairaText(v: Cell): string {
    if (v === null || v === "") return "";
    const raw = String(v);
    const neg = raw.startsWith("-");
    const digits = raw.replace("-", "").padStart(3, "0");
    return `${neg ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/* A spreadsheet runs a cell that starts with = + - @ as a formula. Text cells that start that way are defused with a leading quote. */
const defuse = (s: string): string => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
const quote = (s: string): string => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

function cell(c: ReportColumn, v: Cell): string {
    if (v === null || v === undefined) return "";
    if (c.type === "money") return nairaText(v);
    if (c.type === "text") return quote(defuse(String(v)));
    return quote(String(v));
}

/* RFC 4180 CSV with a byte order mark so Excel reads it as UTF-8. Money is written in naira. */
export function toCsv(report: ReportResult): string {
    const head = report.columns.map(c => quote(c.type === "money" ? `${c.label} (NGN)` : c.label)).join(",");
    const body = report.rows.map(r => report.columns.map(c => cell(c, r[c.key] ?? null)).join(","));
    return `﻿${[head, ...body].join("\r\n")}\r\n`;
}
