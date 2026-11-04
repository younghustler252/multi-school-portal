import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SchoolAdminDirectory } from "../../src/modules/school/services/school-admin-directory.service";
import { TenantContext } from "../../src/infrastructure/database/prisma/tenant.context";

const schools: Record<string, any> = {
    ready:   { id: "ready",   schemaName: "school_ready", schemaProvisionedAt: new Date() },
    pending: { id: "pending", schemaName: null,           schemaProvisionedAt: null },
    broken:  { id: "broken",  schemaName: "school_broken", schemaProvisionedAt: new Date() },
};

function build() {
    const asked: any[] = [];
    const seenSchemas: (string | undefined)[] = [];
    const prismaClient: any = {
        school: { findFirst: async ({ where }: any) => schools[where.id] ?? null },
        user: { findMany: async (args: any) => { asked.push(args); return [
            { id: "u1", email: "ada@x.ng", phone: "0801", firstName: "Ada" },
            { id: "u2", email: "bola@x.ng", phone: null, firstName: null },
        ]; } },
    };
    const membershipService: any = {
        listActiveUserIdsByRoleKey: async (key: string) => {
            seenSchemas.push((TenantContext as any).get?.()?.tenantSchema ?? (TenantContext as any).getStore?.()?.tenantSchema);
            assert.equal(key, "school_admin");
            if (TenantContext && seenSchemas.at(-1) === "school_broken") throw new Error("schema unreadable");
            return ["u1", "u2"];
        },
    };
    return { dir: new SchoolAdminDirectory({ prismaClient, membershipService }), asked, seenSchemas };
}

describe("school admin directory", () => {
    it("finds admins through the school's memberships (active users only, oldest first), not a column on the user", async () => {
        const { dir, asked } = build();
        const list = await dir.contactsOf("ready");
        assert.deepEqual(list.map(c => c.email), ["ada@x.ng", "bola@x.ng"]);
        assert.deepEqual(asked[0].where, { id: { in: ["u1", "u2"] }, isActive: true });
        assert.deepEqual(asked[0].orderBy, { createdAt: "asc" });
        assert.equal((await dir.firstContactOf("ready"))!.userId, "u1");
        assert.equal(list[1].phone, null); assert.equal(list[1].firstName, null);
    });
    it("a school that is not built yet, or does not exist, has no contacts", async () => {
        const { dir } = build();
        assert.deepEqual(await dir.contactsOf("pending"), []);
        assert.deepEqual(await dir.contactsOf("missing"), []);
        assert.equal(await dir.firstContactOf("pending"), null);
    });
    it("one unreadable school never stops a broadcast and is reported", async () => {
        const { dir } = build();
        const errors: string[] = [];
        const all = await dir.contactsOfSchools(["broken", "ready"], (id) => errors.push(id));
        assert.equal(all.length, 2); assert.deepEqual(errors, ["broken"]);
    });
});
