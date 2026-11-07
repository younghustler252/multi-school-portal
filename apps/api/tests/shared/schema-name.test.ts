import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidSchemaName, schemaNameFor } from "../../src/shared/utils/schema-name";

describe("tenant schema names", () => {
    it("turns hyphens into underscores", () => {
        assert.equal(schemaNameFor("core-test-mw6ivbqpk3lq"), "school_core_test_mw6ivbqpk3lq");
        assert.ok(isValidSchemaName(schemaNameFor("core-test-mw6ivbqpk3lq")));
    });
    it("leaves a plain subdomain readable", () => assert.equal(schemaNameFor("greenfield"), "school_greenfield"));
    it("always gives a valid name, even for the longest allowed subdomain", () => {
        const sub = ("a-b".repeat(17)).slice(0, 50);
        assert.ok(isValidSchemaName(schemaNameFor(sub)));
    });
    it("two different subdomains never share a schema name", () => {
        assert.notEqual(schemaNameFor("a-b"), schemaNameFor("ab"));
        assert.notEqual(schemaNameFor("a-b-c"), schemaNameFor("a-bc"));
    });
    it("rejects what cannot be a schema name", () => {
        for (const bad of ["school_core-test", "School_x", "1school", "school x", 'school_"x', "", null, undefined, "s".repeat(64)])
            assert.equal(isValidSchemaName(bad), false, String(bad));
        assert.throws(() => schemaNameFor("---"));
    });
});
