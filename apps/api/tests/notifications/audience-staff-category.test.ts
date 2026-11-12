import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { both, staffAudienceWhere } from "../../src/modules/notifications/domain/audience";

const NORTH = "22222222-2222-4222-8222-222222222222";

describe("staff audience: branch and (new) category", () => {
    it("without a category nothing changes: no filter, or the same branch filter as before", () => {
        assert.deepEqual(staffAudienceWhere({}), {});
        assert.deepEqual(staffAudienceWhere({ branchIds: [NORTH] }), { branches: { some: { branchId: { in: [NORTH] } } } });
        assert.deepEqual(staffAudienceWhere({ staffCategories: [] }), {});
    });
    it("a category narrows staff to teaching or non-teaching", () => {
        assert.deepEqual(staffAudienceWhere({ staffCategories: ["teaching"] }), { category: { in: ["teaching"] } });
        assert.deepEqual(staffAudienceWhere({ staffCategories: ["teaching", "non_teaching"] }), { category: { in: ["teaching", "non_teaching"] } });
    });
    it("branch and category together are both required", () => {
        assert.deepEqual(staffAudienceWhere({ branchIds: [NORTH], staffCategories: ["non_teaching"] }), {
            AND: [{ branches: { some: { branchId: { in: [NORTH] } } } }, { category: { in: ["non_teaching"] } }],
        });
    });
    it("the category is not part of the student or guardian filters", async () => {
        const { studentAudienceWhere, guardianAudienceWhere } = await import("../../src/modules/notifications/domain/audience");
        assert.deepEqual(studentAudienceWhere({ staffCategories: ["teaching"] }), {});
        assert.deepEqual(guardianAudienceWhere({ staffCategories: ["teaching"] }), {});
        assert.deepEqual(both({}, {}), {});
    });
});
