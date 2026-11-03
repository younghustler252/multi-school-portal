import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { branchErrors } from "../../src/modules/branches/domain/branch.errors";

describe("a branch that still has classes or staff cannot be switched off or deleted", () => {
    it("the refusal says what is still attached", () => {
        const e: any = branchErrors.inUse(4, { classes: 3, staff: 1 });
        assert.equal(e.code, "BRANCH_IN_USE");
        assert.equal(e.statusCode, 409);
        assert.ok(e.message.includes("3 classes and 1 staff"));
        assert.deepEqual(e.details, { members: 4, classes: 3, staff: 1 });
    });
    it("still gives a sensible message when no breakdown is passed", () => {
        assert.ok((branchErrors.inUse(2) as any).message.includes("2 active item(s)"));
    });
});
