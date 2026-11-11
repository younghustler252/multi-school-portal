import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeTrustProxy, parseTrustProxy, TrustProxyConfigError } from "../../src/shared/utils/trust-proxy";

describe("TRUST_PROXY parsing", () => {
    it("trusts nothing when unset, empty, false or 0", () => {
        for (const v of [undefined, "", "  ", "false", "FALSE", "0"]) assert.equal(parseTrustProxy(v, "production"), false, String(v));
    });

    it("accepts a hop count from 1 to 10", () => {
        assert.equal(parseTrustProxy("1", "production"), 1);
        assert.equal(parseTrustProxy(" 2 ", "production"), 2);
        assert.equal(parseTrustProxy("10", "production"), 10);
        assert.throws(() => parseTrustProxy("11", "production"), TrustProxyConfigError);
    });

    it("accepts addresses, CIDR ranges and Express' named ranges, as a list", () => {
        assert.deepEqual(parseTrustProxy("loopback", "production"), ["loopback"]);
        assert.deepEqual(parseTrustProxy("172.18.0.0/16", "production"), ["172.18.0.0/16"]);
        assert.deepEqual(parseTrustProxy("10.0.0.5, fd00::/8 ,LOOPBACK", "production"), ["10.0.0.5", "fd00::/8", "loopback"]);
        assert.deepEqual(parseTrustProxy("2001:db8::1", "production"), ["2001:db8::1"]);
    });

    it("refuses to trust everyone", () => {
        for (const v of ["*", "0.0.0.0/0", "::/0", "10.0.0.1, 0.0.0.0/0", "10.0.0.0/0"]) {
            assert.throws(() => parseTrustProxy(v, "production"), TrustProxyConfigError, v);
        }
    });

    it("refuses 'true' in production, allows one hop in development", () => {
        assert.throws(() => parseTrustProxy("true", "production"), /forge/);
        assert.equal(parseTrustProxy("true", "development"), 1);
    });

    it("rejects malformed values with a message that names the variable", () => {
        for (const v of ["nginx", "10.0.0.1/33", "::1/129", "10.0.0.1/abc", "10.0.0.1/8/8", "999.1.1.1", "10.0.0.1,,"]) {
            assert.throws(() => parseTrustProxy(v, "production"), /TRUST_PROXY/, v);
        }
    });

    it("describes the setting for the startup log", () => {
        assert.match(describeTrustProxy(false), /off/);
        assert.equal(describeTrustProxy(2), "2 hop(s)");
        assert.equal(describeTrustProxy(["loopback", "10.0.0.0/8"]), "loopback, 10.0.0.0/8");
    });
});
