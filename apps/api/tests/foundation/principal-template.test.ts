/*
| THE PRINCIPAL DEFAULT ROLE: oversees, signs off and approves; does not change how the school is configured.
| This pins the decision down so a later edit to the template cannot quietly widen it again.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import { ROLE_REVOCATIONS } from "../../src/foundation/role-revocations.registry";
import { validateRevocations } from "../../src/foundation/role-grants.planner";

const principal = ROLE_TEMPLATES.find(t => t.key === "principal")!;
const has = (key: string, scope?: string) => principal.permissions.some(p => p.key === key && (!scope || p.scope === scope));

describe("principal default role", () => {
    it("no longer changes school configuration", () => {
        for (const key of ["school.update", "school_settings.manage", "automation.manage", "message_templates.manage"]) assert.equal(has(key), false, key);
    });
    it("keeps looking at all of it (the matching view permissions) and keeps sending announcements", () => {
        for (const key of ["school.view", "school_settings.view", "automation.view", "message_templates.view", "notifications.view", "notifications.send"]) assert.equal(has(key, "ALL"), true, key);
    });
    it("keeps academic and financial oversight, and the approvals", () => {
        for (const key of ["students.view", "attendance.view", "grades.view", "fees.view", "payments.view", "expenses.approve", "payroll.runs.approve", "payroll.runs.view"]) assert.equal(has(key), true, key);
    });
    it("approves but never prepares: no permission to create or pay expenses or payroll, and none to change finance settings (which could switch self-approval on)", () => {
        const prepares = principal.permissions.map(p => p.key).filter(k => /^(expenses|payroll)\./.test(k) && !/(\.view|\.approve|payslips\.view)$/.test(k));
        assert.deepEqual(prepares, []);
        assert.equal(has("finance.settings.manage"), false);
    });
    it("every removed permission is named in a revocation, so schools that already have the role are brought in line (untouched roles only)", () => {
        const revoked = ROLE_REVOCATIONS.filter(r => r.templateKey === "principal").flatMap(r => r.permissions);
        for (const key of ["school.update", "school_settings.manage", "automation.manage", "message_templates.manage"]) assert.ok(revoked.includes(key), key);
        assert.deepEqual(validateRevocations(ROLE_REVOCATIONS, ROLE_TEMPLATES.map(t => ({ key: t.key, locked: t.locked, permissions: t.permissions }))), []);
    });
    it("the description tells people what the role is for", () => {
        assert.match(principal.description, /Does not change school configuration/);
    });
});
