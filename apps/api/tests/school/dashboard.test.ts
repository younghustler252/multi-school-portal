/*
| THE SCHOOL DASHBOARD: who gets which section.
| People and academics are head-counts only. They go to anyone who may see the records they count (students.view,
| staff.view) and to anyone given school.dashboard.counts (the bursar), who must NOT need students.view to see numbers.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GetDashboardUseCase } from "../../src/modules/school/usecases/get-dashboard.usecase";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";

function build() {
    const calls = { people: 0, academics: 0, fees: 0, attendance: 0 };
    const d: any = {
        prismaClient: { schoolEntitlementOverride: { findUnique: async () => null }, planEntitlement: { findUnique: async () => null } },
        schoolRepository: { findById: async () => ({ name: "Greenfield", status: "active", isActive: true, schemaProvisionedAt: new Date(), verificationStatus: "verified", timezone: "Africa/Lagos" }) },
        subscriptionRepository: { findActiveBySchoolId: async () => null },
        planRepository: { findById: async () => null },
        schoolTenantRepository: {
            currentTermWithSession: async () => ({ id: "t1", name: "First Term", session: { name: "2026/2027" } }),
            peopleCounts: async () => { calls.people++; return { totalStaff: 12, activeStaff: 11, totalStudents: 300, activeStudents: 290, graduatedStudents: 5, totalGuardians: 250 }; },
            academicCounts: async () => { calls.academics++; return { totalClasses: 9, totalSubjects: 14, activeEnrolments: 288 }; },
            graceDays: async () => 7,
            termInvoiceTotals: async () => { calls.fees++; return { totalInvoicedKobo: 1000, totalCollectedKobo: 600, totalPendingKobo: 400, overdueInvoices: 2 }; },
            attendanceCountsBetween: async () => { calls.attendance++; return {}; },
        },
    };
    return { uc: new GetDashboardUseCase(d), calls };
}
const canOf = (keys: string[]) => (k: string) => keys.includes(k);
const templateKeys = (key: string) => ROLE_TEMPLATES.find(t => t.key === key)!.permissions.map(p => p.key);

describe("dashboard sections", () => {
    it("the bursar (real template) gets the head-counts and the fee figures, without holding students.view or enrolment.view", async () => {
        const keys = templateKeys("bursar");
        assert.ok(!keys.includes("students.view") && !keys.includes("enrolment.view"), "no record-level student access");
        const { uc } = build();
        const r = await uc.execute("s1", canOf(keys));
        assert.deepEqual(r.people, { totalStaff: 12, activeStaff: 11, totalStudents: 300, activeStudents: 290, graduatedStudents: 5, totalGuardians: 250 });
        assert.deepEqual(r.academics, { currentTerm: "2026/2027 First Term", totalClasses: 9, totalSubjects: 14, activeEnrolments: 288 });
        assert.equal(r.fees?.totalCollectedKobo, 600);
        assert.equal(r.attendance, null, "attendance is still not the bursar's");
    });
    it("the figures are numbers only: nothing in the answer identifies a student, class list or guardian", async () => {
        const r = await build().uc.execute("s1", canOf(templateKeys("bursar")));
        const walk = (v: unknown): void => { if (v && typeof v === "object") Object.values(v).forEach(walk); else assert.ok(typeof v === "number" || typeof v === "string" || v === null, "plain value"); };
        walk(r.people); walk(r.academics);
        assert.deepEqual(Object.keys(r.people!).sort(), ["activeStaff", "activeStudents", "graduatedStudents", "totalGuardians", "totalStaff", "totalStudents"]);
    });
    it("without students.view, staff.view or the counts permission, both sections are null and are not even computed", async () => {
        const { uc, calls } = build();
        const r = await uc.execute("s1", canOf(["school.dashboard.view", "fees.view"]));
        assert.equal(r.people, null); assert.equal(r.academics, null);
        assert.equal(calls.people, 0); assert.equal(calls.academics, 0);
        assert.ok(r.fees);
    });
    it("holding the counts permission alone is enough for both sections", async () => {
        const r = await build().uc.execute("s1", canOf(["school.dashboard.view", "school.dashboard.counts"]));
        assert.ok(r.people); assert.ok(r.academics); assert.equal(r.fees, null);
    });
    it("the principal and the teacher keep what they had (students.view still opens both sections)", async () => {
        for (const role of ["principal", "teacher"]) {
            const r = await build().uc.execute("s1", canOf(templateKeys(role)));
            if (!templateKeys(role).includes("school.dashboard.view")) continue;
            assert.ok(r.people && r.academics, role);
        }
        const r = await build().uc.execute("s1", canOf(["school.dashboard.view", "students.view"]));
        assert.ok(r.people && r.academics);
    });
    it("staff.view alone still shows the people section, but not academics", async () => {
        const r = await build().uc.execute("s1", canOf(["school.dashboard.view", "staff.view"]));
        assert.ok(r.people); assert.equal(r.academics, null);
    });
    it("the counts permission is held by the bursar only among the default roles (the school admin has everything)", () => {
        const holders = ROLE_TEMPLATES.filter(t => t.permissions.some(p => p.key === "school.dashboard.counts")).map(t => t.key);
        assert.deepEqual(holders, ["bursar"]);
    });
});
