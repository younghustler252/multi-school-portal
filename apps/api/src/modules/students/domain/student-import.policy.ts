import { parse } from "csv-parse/sync";
import { GUARDIAN_RELATIONS, GuardianRelation } from "../../guardians/domain/guardian.policy";

/*
|--------------------------------------------------------------------------
| STUDENT IMPORT RULES (pure: no database, easy to test)
| The same function decides every row for the PREVIEW and for the real IMPORT, so they cannot disagree.
| A row is: ok (will be saved), skipped (the student is already in the school or repeated in the file) or error (fix the row).
|--------------------------------------------------------------------------
*/
export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export const IMPORT_COLUMNS = ["firstName", "lastName", "middleName", "dateOfBirth", "gender", "admissionNumber", "className",
    "guardianFirstName", "guardianLastName", "guardianEmail", "guardianPhone", "guardianRelation"] as const;
export type ImportColumn = typeof IMPORT_COLUMNS[number];
export const REQUIRED_COLUMNS: ImportColumn[] = ["firstName", "lastName"];
export type RawRow = Partial<Record<ImportColumn, string>> & { __row: number };

export const IMPORT_TEMPLATE = `${IMPORT_COLUMNS.join(",")}\r\nAda,Obi,Chioma,25/03/2014,female,,JSS 1A,Ngozi,Obi,ngozi.obi@example.com,08031234567,mother\r\n`;

/* ---------- reading the file ---------- */
const squash = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
const COLUMN_BY_SQUASHED = new Map<string, ImportColumn>(IMPORT_COLUMNS.map(c => [squash(c), c]));

export type FileProblem = { code: "empty" | "excel" | "too_many_rows" | "missing_columns" | "unreadable"; message: string; missing?: string[] };
export interface ParsedFile { rows: RawRow[]; ignoredColumns: string[] }

/** Read a CSV upload. Headings may be written any way ("First Name", "first_name"). Row numbers are the ones a person sees in the sheet (the heading is row 1). */
export function parseImportCsv(buffer: Buffer): ParsedFile | FileProblem {
    if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) return { code: "excel", message: "This looks like an Excel file. Open it in Excel, choose Save As, pick CSV, and upload that file" };
    let records: string[][];
    try { records = parse(buffer, { bom: true, skip_empty_lines: true, relax_column_count: true, trim: true }) as string[][]; }
    catch { return { code: "unreadable", message: "The file could not be read as a CSV. Save it as CSV (comma separated) and try again" }; }
    if (records.length === 0) return { code: "empty", message: "The file is empty" };

    const headers = records[0].map(h => COLUMN_BY_SQUASHED.get(squash(h)));
    const ignoredColumns = records[0].filter((_, i) => !headers[i] && records[0][i] !== "");
    const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
    if (missing.length) return { code: "missing_columns", message: `The file needs these columns: ${missing.join(", ")}`, missing };
    const body = records.slice(1);
    if (body.length === 0) return { code: "empty", message: "The file has a heading row but no students" };
    if (body.length > MAX_IMPORT_ROWS) return { code: "too_many_rows", message: `A file can have at most ${MAX_IMPORT_ROWS} students. Split it into smaller files` };

    const rows = body.map((cells, i) => {
        const r: RawRow = { __row: i + 2 };
        headers.forEach((col, ci) => { if (col && (cells[ci] ?? "") !== "") r[col] = cells[ci]; });
        return r;
    });
    return { rows, ignoredColumns };
}
export const isFileProblem = (x: ParsedFile | FileProblem): x is FileProblem => (x as FileProblem).code !== undefined;

/* ---------- single values ---------- */
/** "2014-03-25" or "25/03/2014" (day first, as in Nigeria) -> that date at 00:00 UTC. Not a real date, or in the future -> an error message. */
export function parseBirthDate(text: string, now: Date = new Date()): { date: Date } | { error: string } {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text), dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    const [y, m, d] = iso ? [+iso[1], +iso[2], +iso[3]] : dmy ? [+dmy[3], +dmy[2], +dmy[1]] : [0, 0, 0];
    if (!y) return { error: `Date of birth "${text}" is not understood. Use 25/03/2014 or 2014-03-25` };
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return { error: `Date of birth "${text}" is not a real date` };
    if (date.getTime() > now.getTime()) return { error: `Date of birth "${text}" is in the future` };
    return { date };
}
export function parseGender(text: string): "male" | "female" | null {
    const t = text.trim().toLowerCase();
    return t === "male" || t === "m" ? "male" : t === "female" || t === "f" ? "female" : null;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dayText = (d: Date) => d.toISOString().slice(0, 10);
export const personKey = (first: string, last: string, dob: Date) => `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}|${dayText(dob)}`;

/* ---------- deciding every row ---------- */
export interface ClassInfo { id: string; name: string; capacity: number | null; enrolled: number; branchId?: string }   // a student imported with a class takes that class's branch
export interface ImportContext {
    now: Date;
    hasCurrentTerm: boolean;
    classes: Map<string, ClassInfo>;                // key: class name, lower case
    existingAdmissionNumbers: Set<string>;          // of the numbers typed in the file, the ones already in the school
    existingPeople: Set<string>;                    // personKey of students already in the school
}
export interface PlannedStudent {
    firstName: string; lastName: string; middleName?: string; dateOfBirth?: Date; gender?: "male" | "female";
    admissionNumber: string | null;                 // null = generate the next free one
}
export interface PlannedGuardian { firstName: string; lastName: string; email: string; phone?: string; relation: GuardianRelation }
export interface PlannedRow {
    row: number; status: "ok" | "skipped" | "error"; messages: string[];
    student?: PlannedStudent; classId?: string; className?: string; guardian?: PlannedGuardian;
    name: string;
}

const clean = (s: string | undefined) => (s ?? "").trim();

export function planImportRows(rows: RawRow[], ctx: ImportContext): { rows: PlannedRow[]; summary: { total: number; ok: number; skipped: number; errors: number } } {
    const seenNumbers = new Map<string, number>(), seenPeople = new Map<string, number>(), planned = new Map<string, number>();
    const out: PlannedRow[] = rows.map(r => {
        const errors: string[] = [];
        const first = clean(r.firstName), last = clean(r.lastName);
        const name = `${first} ${last}`.trim() || `Row ${r.__row}`;
        if (!first) errors.push("First name is required");
        if (!last) errors.push("Last name is required");
        for (const [label, v] of [["First name", first], ["Last name", last], ["Middle name", clean(r.middleName)]] as const) if (v.length > 60) errors.push(`${label} is longer than 60 characters`);

        let dob: Date | undefined;
        if (r.dateOfBirth) { const p = parseBirthDate(clean(r.dateOfBirth), ctx.now); if ("error" in p) errors.push(p.error); else dob = p.date; }
        let gender: "male" | "female" | undefined;
        if (r.gender) { gender = parseGender(r.gender) ?? undefined; if (!gender) errors.push(`Gender "${r.gender}" must be male or female`); }
        const admissionNumber = clean(r.admissionNumber) || null;
        if (admissionNumber && admissionNumber.length > 30) errors.push("Admission number is longer than 30 characters");

        // guardian: all three of first name, last name and email once any guardian detail is given
        let guardian: PlannedGuardian | undefined;
        const g = { first: clean(r.guardianFirstName), last: clean(r.guardianLastName), email: clean(r.guardianEmail).toLowerCase(), phone: clean(r.guardianPhone), relation: clean(r.guardianRelation).toLowerCase() };
        if (g.first || g.last || g.email || g.phone || g.relation) {
            const missing = [!g.first && "guardian first name", !g.last && "guardian last name", !g.email && "guardian email"].filter(Boolean);
            if (missing.length) errors.push(`Missing ${missing.join(", ")}`);
            else if (!EMAIL.test(g.email)) errors.push(`Guardian email "${g.email}" is not a valid email address`);
            else if (g.relation && !(GUARDIAN_RELATIONS as readonly string[]).includes(g.relation)) errors.push(`Guardian relation "${g.relation}" must be one of: ${GUARDIAN_RELATIONS.join(", ")}`);
            else if (g.phone.length > 20) errors.push("Guardian phone is longer than 20 characters");
            else guardian = { firstName: g.first, lastName: g.last, email: g.email, phone: g.phone || undefined, relation: (g.relation || "guardian") as GuardianRelation };
        }

        // class: must exist, a term must be current, and there must be room
        let cls: ClassInfo | undefined;
        const className = clean(r.className);
        if (className) {
            cls = ctx.classes.get(className.toLowerCase());
            if (!cls) errors.push(`Class "${className}" does not exist. Check the spelling or create the class first`);
            else if (!ctx.hasCurrentTerm) errors.push("There is no current term, so a class cannot be assigned. Set the current term first");
        }
        if (errors.length) return { row: r.__row, status: "error" as const, messages: errors, name };

        // duplicates: skipped, never an error, so the same file can be uploaded twice safely
        const skip: string[] = [];
        if (admissionNumber) {
            if (ctx.existingAdmissionNumbers.has(admissionNumber)) skip.push(`Admission number ${admissionNumber} is already in the school`);
            else if (seenNumbers.has(admissionNumber)) skip.push(`Admission number ${admissionNumber} is already used on row ${seenNumbers.get(admissionNumber)}`);
        }
        const key = dob ? personKey(first, last, dob) : null;
        if (key) {
            if (ctx.existingPeople.has(key)) skip.push("A student with the same name and date of birth is already in the school");
            else if (seenPeople.has(key)) skip.push(`Same name and date of birth as row ${seenPeople.get(key)}`);
        }
        if (skip.length) return { row: r.__row, status: "skipped" as const, messages: skip, name };

        if (cls && cls.capacity && cls.enrolled + (planned.get(cls.id) ?? 0) + 1 > cls.capacity)
            return { row: r.__row, status: "error" as const, messages: [`${cls.name} is full (${cls.capacity} students)`], name };

        if (admissionNumber) seenNumbers.set(admissionNumber, r.__row);
        if (key) seenPeople.set(key, r.__row);
        if (cls) planned.set(cls.id, (planned.get(cls.id) ?? 0) + 1);
        return {
            row: r.__row, status: "ok" as const, messages: [], name,
            student: { firstName: first, lastName: last, middleName: clean(r.middleName) || undefined, dateOfBirth: dob, gender, admissionNumber },
            classId: cls?.id, className: cls?.name, guardian,
        };
    });
    const count = (s: PlannedRow["status"]) => out.filter(r => r.status === s).length;
    return { rows: out, summary: { total: out.length, ok: count("ok"), skipped: count("skipped"), errors: count("error") } };
}
