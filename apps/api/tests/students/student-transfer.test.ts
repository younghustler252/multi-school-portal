import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planTransfer } from "../../src/modules/students/domain/student-transfer.policy";
import { TransferStudentDto } from "../../src/modules/students/dtos/student.dto";
import { findBranchMismatches, sameBranch } from "../../src/modules/enrolment/services/branch-rule";

const MAIN = "m", NORTH = "n";
const student = { branchId: MAIN, graduatedAt: null };
const klass = (branchId: string) => ({ id: "c-new", branchId });
const placed = { id: "e1", classId: "c-old" };
const U = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe("authorised student transfer: the only way across branches", () => {
    it("a student with a class place moves with it: the class must be chosen and be in the NEW branch", () => {
        const plan = planTransfer({ student, toBranchId: NORTH, classId: "c-new", enrolment: placed, targetClass: klass(NORTH) });
        assert.deepEqual(plan.moveEnrolment, { enrolmentId: "e1", fromClassId: "c-old", toClassId: "c-new" });
        assert.throws(() => planTransfer({ student, toBranchId: NORTH, classId: undefined, enrolment: placed, targetClass: null }), { code: "TRANSFER_CLASS_REQUIRED" });
        assert.throws(() => planTransfer({ student, toBranchId: NORTH, classId: "c-new", enrolment: placed, targetClass: null }), { code: "TRANSFER_CLASS_INVALID" });
        assert.throws(() => planTransfer({ student, toBranchId: NORTH, classId: "c-new", enrolment: placed, targetClass: klass(MAIN) }), { code: "TRANSFER_CLASS_BRANCH_MISMATCH" });
    });
    it("a student with no active place just changes branch, and no class may be sent", () => {
        assert.deepEqual(planTransfer({ student, toBranchId: NORTH, classId: undefined, enrolment: null, targetClass: null }), { moveEnrolment: null });
        assert.throws(() => planTransfer({ student, toBranchId: NORTH, classId: "c-new", enrolment: null, targetClass: klass(NORTH) }), { code: "TRANSFER_CLASS_NOT_NEEDED" });
    });
    it("the same branch and graduates are refused", () => {
        assert.throws(() => planTransfer({ student, toBranchId: MAIN, classId: undefined, enrolment: null, targetClass: null }), { code: "STUDENT_ALREADY_IN_BRANCH" });
        assert.throws(() => planTransfer({ student: { ...student, graduatedAt: new Date() }, toBranchId: NORTH, classId: undefined, enrolment: null, targetClass: null }), { code: "STUDENT_GRADUATED" });
    });
    it("the request needs a branch and a real reason; unknown fields are rejected", () => {
        assert.equal(TransferStudentDto.safeParse({ toBranchId: U(1), reason: "Family moved to Abuja" }).success, true);
        assert.equal(TransferStudentDto.safeParse({ toBranchId: U(1), classId: U(2), reason: "Family moved" }).success, true);
        assert.equal(TransferStudentDto.safeParse({ toBranchId: U(1) }).success, false);
        assert.equal(TransferStudentDto.safeParse({ toBranchId: U(1), reason: "no" }).success, false);
        assert.equal(TransferStudentDto.safeParse({ toBranchId: U(1), reason: "Family moved", studentId: U(3) }).success, false);
    });
    it("the promotion rule and the transfer rule agree: after a transfer the same placement is allowed", () => {
        const rows = [{ studentId: "s1", toClassId: "c-new" }];
        assert.equal(findBranchMismatches(rows, new Map([["s1", MAIN]]), new Map([["c-new", NORTH]])).length, 1);   // before the transfer: blocked
        assert.equal(findBranchMismatches(rows, new Map([["s1", NORTH]]), new Map([["c-new", NORTH]])).length, 0);  // after the transfer: fine
        assert.equal(sameBranch("a", "a"), true); assert.equal(sameBranch("a", "b"), false);
        assert.equal(findBranchMismatches([{ studentId: "s1", toClassId: null }], new Map(), new Map()).length, 0);  // graduating: no class, no issue
    });
});
