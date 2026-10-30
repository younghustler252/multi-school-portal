import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("test setup safety", () => {
    it("runs as the test environment", () => {
        assert.equal(process.env.NODE_ENV, "test");
    });

    it("never points at anything except the test database (or a dead address)", () => {
        const expected = process.env.TEST_DATABASE_URL ?? "postgresql://nobody:nobody@127.0.0.1:1/none";
        assert.equal(process.env.DATABASE_URL, expected);
    });

    it("never uses a real payment key", () => {
        assert.equal(process.env.PAYSTACK_SECRET_KEY, "sk_test_dummy");
    });
});
