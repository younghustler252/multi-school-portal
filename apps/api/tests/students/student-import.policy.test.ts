import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseImportCsv, isFileProblem, parseBirthDate, parseGender, planImportRows, personKey, IMPORT_TEMPLATE, MAX_IMPORT_ROWS, ImportContext, RawRow } from "../../src/modules/students/domain/student-import.policy";

const NOW = new Date("2026-11-05T10:00:00Z");
const ctx = (over: Partial<ImportContext> = {}): ImportContext => ({
    now: NOW, hasCurrentTerm: true, existingAdmissionNumbers: new Set(), existingPeople: new Set(),
    classes: new Map([["jss 1a", { id: "c1", name: "JSS 1A", capacity: 2, enrolled: 0 }], ["jss 2a", { id: "c2", name: "JSS 2A", capacity: null, enrolled: 40 }]]), ...over,
});
const row = (n: number, o: Partial<RawRow> = {}): RawRow => ({ __row: n, firstName: "Ada", lastName: "Obi", ...o });
const plan = (rows: RawRow[], c = ctx()) => planImportRows(rows, c);

describe("reading the CSV", () => {
    const csv = (s: string) => Buffer.from(s, "utf8");
    it("reads headings written any way, gives the row numbers a person sees, and lists columns it ignores", () => {
        const r = parseImportCsv(csv("\uFEFFFirst Name,last_name,DATE OF BIRTH,Favourite food\r\nAda,Obi,25/03/2014,rice\r\nBola,Eze,,beans\r\n"));
        assert.ok(!isFileProblem(r));
        if (isFileProblem(r)) return;
        assert.deepEqual(r.rows, [{ __row: 2, firstName: "Ada", lastName: "Obi", dateOfBirth: "25/03/2014" }, { __row: 3, firstName: "Bola", lastName: "Eze" }]);
        assert.deepEqual(r.ignoredColumns, ["Favourite food"]);
    });
    it("the template reads back as one valid student", () => {
        const r = parseImportCsv(csv(IMPORT_TEMPLATE)); assert.ok(!isFileProblem(r));
        if (!isFileProblem(r)) { assert.equal(r.rows.length, 1); assert.equal(plan(r.rows).summary.ok, 1); }
    });
    it("says what is wrong: empty, heading only, missing columns, an Excel file, too many rows, garbage", () => {
        const code = (b: Buffer) => { const r = parseImportCsv(b); return isFileProblem(r) ? r.code : "fine"; };
        assert.equal(code(csv("")), "empty");
        assert.equal(code(csv("firstName,lastName\r\n")), "empty");
        assert.equal(code(csv("firstName\r\nAda\r\n")), "missing_columns");
        assert.equal(code(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])), "excel");
        assert.equal(code(csv("firstName,lastName\r\n" + "A,B\r\n".repeat(MAX_IMPORT_ROWS + 1))), "too_many_rows");
        assert.equal(code(csv("firstName,lastName\r\n" + "A,B\r\n".repeat(MAX_IMPORT_ROWS))), "fine", "exactly the limit is allowed");
        assert.equal(code(csv('firstName,lastName\r\n"Ada,Obi\r\n')), "unreadable");
    });
});

describe("single values", () => {
    it("dates: YYYY-MM-DD and DD/MM/YYYY (day first); not real, not understood, or in the future are refused", () => {
        const ok = (t: string) => (parseBirthDate(t, NOW) as any).date?.toISOString().slice(0, 10);
        assert.deepEqual([ok("2014-03-25"), ok("25/03/2014"), ok("5/3/2014")], ["2014-03-25", "2014-03-25", "2014-03-05"]);
        for (const bad of ["31/02/2014", "2014-02-30", "03/25/2014", "March 2014", "2030-01-01", "25-03-2014"]) assert.ok("error" in parseBirthDate(bad, NOW), bad);
    });
    it("gender: male, female, m, f in any case", () => {
        assert.deepEqual(["Male", "F", " female ", "m", "x", ""].map(parseGender), ["male", "female", "female", "male", null, null]);
    });
});

describe("deciding every row", () => {
    it("a good row is ok, and keeps what it needs", () => {
        const r = plan([row(2, { middleName: "Chioma", dateOfBirth: "25/03/2014", gender: "F", className: "jss 1a" })]).rows[0];
        assert.equal(r.status, "ok");
        assert.deepEqual([r.student!.firstName, r.student!.middleName, r.student!.gender, r.student!.admissionNumber, r.classId, r.className], ["Ada", "Chioma", "female", null, "c1", "JSS 1A"]);
    });
    it("problems are errors that name the row's trouble in plain words; nothing is guessed", () => {
        const msgs = (o: Partial<RawRow>, c = ctx()) => plan([row(2, o)], c).rows[0].messages.join(" | ");
        assert.match(msgs({ firstName: "" }), /First name is required/);
        assert.match(msgs({ gender: "x" }), /must be male or female/);
        assert.match(msgs({ dateOfBirth: "31/02/2014" }), /not a real date/);
        assert.match(msgs({ className: "JSS 9Z" }), /does not exist/);
        assert.match(msgs({ className: "JSS 1A" }, ctx({ hasCurrentTerm: false })), /no current term/);
        assert.match(msgs({ guardianEmail: "ngozi@x.com" }), /Missing guardian first name, guardian last name/);
        assert.match(msgs({ guardianFirstName: "N", guardianLastName: "O", guardianEmail: "nope" }), /not a valid email/);
        assert.match(msgs({ guardianFirstName: "N", guardianLastName: "O", guardianEmail: "n@x.com", guardianRelation: "cousin" }), /must be one of/);
    });
    it("a class with no term-room problem and no capacity set takes anyone", () => assert.equal(plan([row(2, { className: "JSS 2A" })]).rows[0].status, "ok"));
    it("the same file twice adds nothing: students already in the school are SKIPPED, not errors", () => {
        const c = ctx({ existingAdmissionNumbers: new Set(["GFA/2026/001"]), existingPeople: new Set([personKey("Ada", "Obi", new Date("2014-03-25T00:00:00Z"))]) });
        const r = plan([row(2, { admissionNumber: "GFA/2026/001" }), row(3, { dateOfBirth: "25/03/2014" }), row(4, { firstName: "New", lastName: "Kid" })], c);
        assert.deepEqual(r.rows.map(x => x.status), ["skipped", "skipped", "ok"]);
        assert.match(r.rows[0].messages[0], /already in the school/);
        assert.deepEqual(r.summary, { total: 3, ok: 1, skipped: 2, errors: 0 });
    });
    it("a student repeated inside the file is skipped and points at the first row", () => {
        const r = plan([row(2, { dateOfBirth: "2014-03-25", admissionNumber: "A1" }), row(3, { dateOfBirth: "25/03/2014" }), row(4, { firstName: "Other", admissionNumber: "A1" })]);
        assert.deepEqual(r.rows.map(x => x.status), ["ok", "skipped", "skipped"]);
        assert.match(r.rows[1].messages[0], /Same name and date of birth as row 2/);
        assert.match(r.rows[2].messages[0], /already used on row 2/);
    });
    it("the same name without a date of birth is NOT treated as a duplicate (two real children can share a name)", () => {
        assert.deepEqual(plan([row(2), row(3)]).rows.map(x => x.status), ["ok", "ok"]);
    });
    it("class capacity counts the rows already planned for it; a full class makes the extra rows errors", () => {
        const rows = [row(2, { firstName: "A", className: "JSS 1A" }), row(3, { firstName: "B", className: "JSS 1A" }), row(4, { firstName: "C", className: "JSS 1A" })];
        const r = plan(rows);
        assert.deepEqual(r.rows.map(x => x.status), ["ok", "ok", "error"]);
        assert.match(r.rows[2].messages[0], /JSS 1A is full \(2 students\)/);
        assert.equal(plan([row(2, { className: "JSS 1A" })], ctx({ classes: new Map([["jss 1a", { id: "c1", name: "JSS 1A", capacity: 2, enrolled: 2 }]]) })).rows[0].status, "error");
    });
    it("a rejected row does not take a seat or block a later one", () => {
        const r = plan([row(2, { firstName: "A", className: "JSS 1A", gender: "x" }), row(3, { firstName: "B", className: "JSS 1A" }), row(4, { firstName: "C", className: "JSS 1A" })]);
        assert.deepEqual(r.rows.map(x => x.status), ["error", "ok", "ok"]);
    });
    it("a sibling pair in one file with the same parent email plans one guardian shape for both", () => {
        const g = { guardianFirstName: "Ngozi", guardianLastName: "Obi", guardianEmail: "NGOZI@X.com", guardianRelation: "Mother" };
        const r = plan([row(2, { firstName: "A", ...g }), row(3, { firstName: "B", ...g })]);
        assert.deepEqual(r.rows.map(x => [x.status, x.guardian!.email, x.guardian!.relation]), [["ok", "ngozi@x.com", "mother"], ["ok", "ngozi@x.com", "mother"]]);
        assert.equal(plan([row(2, { guardianFirstName: "N", guardianLastName: "O", guardianEmail: "n@x.com" })]).rows[0].guardian!.relation, "guardian", "relation defaults to guardian");
    });
});
