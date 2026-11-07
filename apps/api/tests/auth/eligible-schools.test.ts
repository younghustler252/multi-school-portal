import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MembershipService } from "../../src/modules/auth/services/membership.service";
import { TenantContext } from "../../src/infrastructure/database/prisma/tenant.context";

/*
| UserSchool only DISCOVERS schools. A school is "eligible" only with an ACTIVE tenant Membership, checked in that
| school's own schema. This fakes the public links and the per-school membership lookup.
*/
const school = (id: string, schemaName: string | null = `school_${id}`) =>
    ({ id, name: id.toUpperCase(), subdomain: id, customDomain: null, customDomainVerifiedAt: null, schemaName });

function build(links: ReturnType<typeof school>[], activeIn: Record<string, boolean | Error>) {
    const seen: string[] = [];
    const svc = new MembershipService({
        prismaClient: { userSchool: { findMany: async () => links.map(school => ({ school })) } } as any,
        urlService: { schoolUrl: (s: any) => `https://${s.subdomain}.example.test` } as any,
    });
    // the tenant lookup: answer per school, using the schema the service put in the tenant context
    (svc as any).listActive = async () => {
        const schema = TenantContext.getSchema(); seen.push(schema);
        const v = activeIn[schema];
        if (v instanceof Error) throw v;
        return v ? [{ id: "m", userId: "u", persona: "STAFF", personaEntityId: "e", status: "active" }] : [];
    };
    return { svc, seen };
}

describe("listEligibleSchools", () => {
    it("a UserSchool link WITHOUT an active membership does not make a school eligible", async () => {
        const { svc } = build([school("a"), school("b")], { school_a: true, school_b: false });
        assert.deepEqual((await svc.listEligibleSchools("u")).map(s => s.id), ["a"]);
    });

    it("checks each school in its OWN schema", async () => {
        const { svc, seen } = build([school("a"), school("b")], { school_a: true, school_b: true });
        await svc.listEligibleSchools("u");
        assert.deepEqual(seen.sort(), ["school_a", "school_b"]);
    });

    it("a school that cannot be checked (error) is left out, not guessed in", async () => {
        const { svc } = build([school("a"), school("b")], { school_a: true, school_b: new Error("boom") });
        const orig = console.error; console.error = () => {};
        try { assert.deepEqual((await svc.listEligibleSchools("u")).map(s => s.id), ["a"]); } finally { console.error = orig; }
    });

    it("a school with an invalid stored schema name is skipped without touching the database", async () => {
        const { svc, seen } = build([school("a", "school_core-test")], {});
        assert.deepEqual(await svc.listEligibleSchools("u"), []);
        assert.deepEqual(seen, []);
    });

    it("returns each school's own address, sorted by name", async () => {
        const { svc } = build([school("zed"), school("alpha")], { school_zed: true, school_alpha: true });
        assert.deepEqual(await svc.listEligibleSchools("u"), [
            { id: "alpha", name: "ALPHA", url: "https://alpha.example.test" },
            { id: "zed", name: "ZED", url: "https://zed.example.test" },
        ]);
    });
});
