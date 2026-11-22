/*
| WHO LEADS OR TEACHES A CLASS: what every module's ASSIGNED scope means, pinned exactly.
| Written BEFORE the rule was moved into one Classes-owned place, so the move can be proven to change nothing: the
| filters and answers below are the ones the code produced when each module kept its own copy.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Access } from "../../src/foundation/access.service";
import { attendanceViewWhere } from "../../src/modules/attendance/services/attendance-scope";
import { enrolmentScopeWhere } from "../../src/modules/enrolment/services/enrolment-scope";
import { studentScopeWhere } from "../../src/modules/students/services/student-scope";
import { gradesViewWhere, sheetsViewWhere, mayViewSheet, mayWorkOnSheet } from "../../src/modules/grades/services/grades-scope";
import { cardsViewWhere, mayViewClass, mayWorkOnClass } from "../../src/modules/report-cards/services/report-card-scope";

const ME = "staff-1";
const staff = (perms: Record<string, string>, id: string | null = ME) => new Access("school", "u1", "m1", "STAFF", id, new Set(), false, new Map(Object.entries(perms)) as any, new Set());
const assigned = (...keys: string[]) => staff(Object.fromEntries(keys.map(k => [k, "ASSIGNED"])));

const LEAD   = { classTeacherId: ME };
const TAUGHT = { classSubjects: { some: { staffId: ME, term: { isCurrent: true } } } };

describe("ASSIGNED filters (exact shapes)", () => {
    it("attendance and enrolment rows: classes led in ANY term, classes taught in the CURRENT term only", () => {
        const rows = { OR: [{ class: LEAD }, { term: { isCurrent: true }, class: TAUGHT }] };
        assert.deepEqual(attendanceViewWhere(assigned("attendance.view")), rows);
        assert.deepEqual(enrolmentScopeWhere(assigned("enrolment.view")), rows);
    });
    it("students: on the list of a class led or taught THIS term", () => {
        assert.deepEqual(studentScopeWhere(assigned("students.view")), { enrolments: { some: { term: { isCurrent: true }, class: { OR: [LEAD, TAUGHT] } } } });
    });
    it("grades and sheets: subjects they teach, or any subject of a class they lead", () => {
        assert.deepEqual(gradesViewWhere(assigned("grades.view")), { classSubject: { OR: [{ staffId: ME }, { class: LEAD }] } });
        assert.deepEqual(sheetsViewWhere(assigned("grades.view")), { OR: [{ staffId: ME }, { class: LEAD }] });
    });
    it("report cards: only the class teacher's own class (a subject teacher does not see the cards)", () => {
        assert.deepEqual(cardsViewWhere(assigned("report_cards.view")), { class: LEAD });
    });
    it("a staff member with no id, or a student/guardian given ASSIGNED, matches nobody", () => {
        const noOne = (w: Record<string, unknown>) => JSON.stringify(w);
        for (const [fn, key] of [[attendanceViewWhere, "attendance.view"], [enrolmentScopeWhere, "enrolment.view"], [studentScopeWhere, "students.view"], [gradesViewWhere, "grades.view"], [cardsViewWhere, "report_cards.view"]] as const) {
            const w = noOne(fn(staff({ [key]: "ASSIGNED" }, null)));
            assert.ok(!w.includes(ME) && w !== "{}", `${key}: no id -> not everything`);
        }
    });
});

describe("ASSIGNED answers for one loaded sheet or class (exact)", () => {
    const a = (k: string) => assigned(k);
    it("a sheet: the subject teacher AND the class teacher may look; only the subject teacher may enter or submit", () => {
        const mine = { staffId: ME, classTeacherId: "other" }, led = { staffId: "other", classTeacherId: ME }, neither = { staffId: "x", classTeacherId: "y" };
        assert.equal(mayViewSheet(a("grades.view"), mine), true); assert.equal(mayViewSheet(a("grades.view"), led), true); assert.equal(mayViewSheet(a("grades.view"), neither), false);
        assert.equal(mayWorkOnSheet(a("grades.enter"), "grades.enter", mine), true);
        assert.equal(mayWorkOnSheet(a("grades.enter"), "grades.enter", led), false, "the class teacher looks, they do not enter");
        assert.equal(mayWorkOnSheet(a("grades.submit"), "grades.submit", neither), false);
    });
    it("report cards: only the class teacher may look at or work on a class", () => {
        assert.equal(mayViewClass(a("report_cards.view"), ME), true); assert.equal(mayViewClass(a("report_cards.view"), "other"), false); assert.equal(mayViewClass(a("report_cards.view"), null), false);
        assert.equal(mayWorkOnClass(a("report_cards.generate"), ME), true); assert.equal(mayWorkOnClass(a("report_cards.generate"), "other"), false);
    });
});
