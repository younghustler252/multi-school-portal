import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PERMISSION_REGISTRY, validatePermissionRegistry } from "../../src/foundation/permissions.registry";

describe("permission registry", () => {
    it("has no problems (no duplicate keys, valid names, realms never cross)", () => {
        assert.deepEqual(validatePermissionRegistry(), []);
    });

    it("is not empty", () => {
        assert.ok(PERMISSION_REGISTRY.length > 0);
    });
});
