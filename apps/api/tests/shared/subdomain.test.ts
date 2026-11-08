import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isReservedSubdomain, normaliseSubdomain, RESERVED_SUBDOMAINS, reservedSubdomains } from "../../src/shared/utils/subdomain";

const cfg = { adminLabel: "admin" };

describe("reserved school subdomains", () => {
    it("blocks www and the admin label", () => {
        assert.equal(isReservedSubdomain("www", cfg), true);
        assert.equal(isReservedSubdomain("admin", cfg), true);
    });

    it("blocks every built-in platform label", () => {
        for (const label of RESERVED_SUBDOMAINS) assert.equal(isReservedSubdomain(label, cfg), true, label);
        for (const label of ["api", "app", "mail", "smtp", "mx", "ns1", "status", "metrics", "staging", "login", "billing"]) {
            assert.ok(RESERVED_SUBDOMAINS.includes(label), `${label} is in the list`);
        }
    });

    it("blocks the CONFIGURED admin label, not only 'admin'", () => {
        const custom = { adminLabel: "Console" };
        assert.equal(isReservedSubdomain("console", custom), true);
        assert.equal(isReservedSubdomain("CONSOLE", custom), true);
        assert.equal(isReservedSubdomain("admin", custom), true, "the default stays reserved");
    });

    it("blocks extra labels from configuration (comma separated, any case, spaces)", () => {
        const withExtra = { adminLabel: "admin", extra: " Partners , ,payments,SANDBOX2 " };
        for (const l of ["partners", "payments", "sandbox2"]) assert.equal(isReservedSubdomain(l, withExtra), true, l);
        assert.equal(isReservedSubdomain("partners", cfg), false, "only when configured");
    });

    it("ignores case and surrounding whitespace", () => {
        for (const l of ["WWW", " www ", "Admin", "\tapi\n", "MaIl"]) assert.equal(isReservedSubdomain(l, cfg), true, JSON.stringify(l));
        assert.equal(normaliseSubdomain("  Greenfield  "), "greenfield");
    });

    it("does not block ordinary school names, near-misses or empty input", () => {
        for (const l of ["greenfield-academy", "wwwschool", "my-admin-school", "api-school", "adminschool", "school1"]) {
            assert.equal(isReservedSubdomain(l, cfg), false, l);
        }
        assert.equal(isReservedSubdomain("", cfg), false);
    });

    it("lists each reserved label once", () => {
        const all = reservedSubdomains({ adminLabel: "www", extra: "api,API" });
        assert.equal(new Set(all).size, all.length);
    });

    it("uses the environment by default (setup gives ADMIN_SUBDOMAIN its default)", () => {
        assert.equal(isReservedSubdomain("www"), true);
        assert.equal(isReservedSubdomain("admin"), true);
        assert.equal(isReservedSubdomain("greenfield"), false);
    });

    it("both ways of creating a school go through the shared rule (no private copy)", () => {
        for (const file of ["src/modules/auth/usecases/register.usecase.ts", "src/modules/school/usecases/platform/create-school.usecase.ts"]) {
            const src = readFileSync(file, "utf8");
            assert.match(src, /isReservedSubdomain\(/, file);
            assert.doesNotMatch(src, /RESERVED_SUBDOMAINS\.includes/, file);
            assert.doesNotMatch(src, /ADMIN_SUBDOMAIN/, file);
        }
    });
});
