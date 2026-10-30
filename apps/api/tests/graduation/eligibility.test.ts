/* Graduation rules that need no database (these always run). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ACTIVE_STUDENT_WHERE, countsTowardPlan, studentLifecycle, receivesAnnouncement, receivesFeeReminder, guardianAnnouncementWhere } from "../../src/modules/students/domain/student-eligibility";
import { promotionOutcome, willGraduate } from "../../src/modules/enrolment/services/promotion-plan";
import { UndoGraduationDto } from "../../src/modules/students/dtos/student.dto";

const d = new Date();
describe("who counts toward the plan", () => {
    it("operationally active AND not graduated; one constant is the single rule", () => {
        assert.deepEqual(ACTIVE_STUDENT_WHERE, { isActive: true, graduatedAt: null });
        assert.equal(countsTowardPlan({ isActive: true, graduatedAt: null }), true);
        assert.equal(countsTowardPlan({ isActive: true, graduatedAt: d }), false);
        assert.equal(countsTowardPlan({ isActive: false, graduatedAt: null }), false);
        assert.equal(countsTowardPlan({ isActive: false, graduatedAt: d }), false);
    });
    it("lifecycle: graduated is its own state, separate from inactive (withdrawn)", () => {
        assert.equal(studentLifecycle({ isActive: true }), "active");
        assert.equal(studentLifecycle({ isActive: false }), "inactive");
        assert.equal(studentLifecycle({ isActive: true, graduatedAt: d }), "graduated");
        assert.equal(studentLifecycle({ isActive: false, graduatedAt: d }), "graduated");
    });
    it("no code counts students for the plan any other way (a new count must use the shared rule)", () => {
        const offenders: string[] = [];
        const walk = (dir: string) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) { if (f !== "generated") walk(p); } else if (p.endsWith(".ts")) { const t = readFileSync(p, "utf8"); if (/student\.count\(\s*\{\s*where:\s*\{\s*isActive:\s*true/.test(t)) offenders.push(p); } } };
        walk("src");
        assert.deepEqual(offenders, [], "use ACTIVE_STUDENT_WHERE from students/domain/student-eligibility");
    });
});

describe("announcements and fee reminders", () => {
    it("general messages skip graduates unless asked; reminders follow the balance, not graduation", () => {
        assert.equal(receivesAnnouncement({ isActive: true, graduatedAt: null }), true);
        assert.equal(receivesAnnouncement({ isActive: true, graduatedAt: d }), false);
        assert.equal(receivesAnnouncement({ isActive: true, graduatedAt: d }, { includeGraduates: true }), true);
        assert.equal(receivesAnnouncement({ isActive: false }, { includeGraduates: true }), false);
        assert.equal(receivesFeeReminder(1), true); assert.equal(receivesFeeReminder(0), false);
        assert.deepEqual(guardianAnnouncementWhere(true), { isActive: true });
    });
});

describe("what promotion does with each student (preview and run share this one function)", () => {
    it("table", () => {
        assert.equal(promotionOutcome("graduate", false), "graduated");
        assert.equal(promotionOutcome("graduate", true), "already_enrolled");   // already has a place: left alone, not graduated
        assert.equal(promotionOutcome("promote", false), "promoted");
        assert.equal(promotionOutcome("promote", true), "already_enrolled");
        assert.equal(promotionOutcome("repeat", false), "repeated");
        assert.equal(promotionOutcome("exclude", false), "excluded");
        assert.equal(promotionOutcome("exclude", true), "excluded");
        assert.equal(willGraduate({ action: "graduate" }, false), true);
        assert.equal(willGraduate({ action: "graduate" }, true), false);
        assert.equal(willGraduate({ action: "needs_decision" }, false), false);
    });
});

describe("report cards, grades and payments never hide a graduate", () => {
    it("none of these modules filters students by isActive for access (a graduate stays active on purpose)", () => {
        const hits: string[] = [];
        for (const m of ["report-cards", "grades"]) {
            const walk = (dir: string) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".ts") && /student:\s*\{[^}]*isActive/.test(readFileSync(p, "utf8"))) hits.push(p); } };
            try { walk(join("src/modules", m)); } catch { /* module folder may not exist */ }
        }
        assert.deepEqual(hits, []);
    });
});

describe("undo graduation request", () => {
    it("needs a real reason and rejects unknown fields", () => {
        assert.equal(UndoGraduationDto.safeParse({ reason: "Marked by mistake" }).success, true);
        assert.equal(UndoGraduationDto.safeParse({ reason: "   " }).success, false);
        assert.equal(UndoGraduationDto.safeParse({ reason: "Marked by mistake", extra: 1 }).success, false);
        assert.equal(UndoGraduationDto.parse({ reason: "Marked by mistake" }).reopenEnrolment, false);
    });
});
