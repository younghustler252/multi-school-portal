import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ManagePlatformUsersUseCase } from "../../src/modules/user/usecases/manage-platform-users.usecase";

const U1 = "u-target";
const actor = { userId: "u-actor", schoolId: null, membershipId: null, ip: "1.2.3.4", userAgent: "test" };

function rig(user: any) {
    const store = { ...user };
    const revoked: string[] = [];
    const audits: any[] = [];
    const userRepository: any = {
        findById: async (id: string) => (id === store.id ? { ...store } : null),
        update: async (id: string, data: any) => { Object.assign(store, data); return { ...store }; },
    };
    const refreshTokenRepository: any = { revokeAllForUser: async (id: string) => { revoked.push(id); } };
    const authAuditService: any = { record: async (e: any) => { audits.push(e); } };
    return { userRepository, refreshTokenRepository, authAuditService, revoked, audits, store };
}

const user = (over: Partial<any> = {}) => ({ id: U1, email: "a@b.ng", firstName: "Ada", lastName: "Obi", isActive: true, lastLoginAt: null, ...over });

describe("find", () => {
    it("404s on an unknown id", async () => {
        const d = rig(user());
        await assert.rejects(() => new ManagePlatformUsersUseCase(d).find("nope"), (e: any) => e.statusCode === 404);
    });
    it("returns a safe summary", async () => {
        const d = rig(user());
        const out = await new ManagePlatformUsersUseCase(d).find(U1);
        assert.deepEqual(out, { id: U1, email: "a@b.ng", firstName: "Ada", lastName: "Obi", isActive: true, lastLoginAt: null });
    });
});

describe("deactivate", () => {
    it("cannot act on your own account", async () => {
        const d = rig(user({ id: actor.userId }));
        await assert.rejects(
            () => new ManagePlatformUsersUseCase(d).deactivate(actor.userId, {}, actor as any),
            (e: any) => e.code === "USER_SELF_ACTION",
        );
    });
    it("404s on an unknown id", async () => {
        const d = rig(user());
        await assert.rejects(() => new ManagePlatformUsersUseCase(d).deactivate("nope", {}, actor as any), (e: any) => e.statusCode === 404);
    });
    it("flips isActive false, revokes every session, and audits with the reason", async () => {
        const d = rig(user());
        const out = await new ManagePlatformUsersUseCase(d).deactivate(U1, { reason: "fraud report" }, actor as any);
        assert.equal(out.isActive, false);
        assert.deepEqual(d.revoked, [U1]);
        assert.equal(d.audits[0].action, "user.deactivated");
        assert.equal(d.audits[0].metadata.reason, "fraud report");
    });
    it("is idempotent: deactivating an already-inactive user changes nothing further", async () => {
        const d = rig(user({ isActive: false }));
        const out = await new ManagePlatformUsersUseCase(d).deactivate(U1, {}, actor as any);
        assert.equal(out.isActive, false);
        assert.equal(d.revoked.length, 0);
        assert.equal(d.audits.length, 0);
    });
});

describe("reactivate", () => {
    it("cannot act on your own account", async () => {
        const d = rig(user({ id: actor.userId, isActive: false }));
        await assert.rejects(
            () => new ManagePlatformUsersUseCase(d).reactivate(actor.userId, actor as any),
            (e: any) => e.code === "USER_SELF_ACTION",
        );
    });
    it("flips isActive true, clears lockout state and audits", async () => {
        const d = rig(user({ isActive: false, failedLoginCount: 4, lockedUntil: new Date() }));
        const out = await new ManagePlatformUsersUseCase(d).reactivate(U1, actor as any);
        assert.equal(out.isActive, true);
        assert.equal(d.store.failedLoginCount, 0);
        assert.equal(d.store.lockedUntil, null);
        assert.equal(d.audits[0].action, "user.reactivated");
    });
    it("is idempotent: reactivating an already-active user audits nothing", async () => {
        const d = rig(user({ isActive: true }));
        const out = await new ManagePlatformUsersUseCase(d).reactivate(U1, actor as any);
        assert.equal(out.isActive, true);
        assert.equal(d.audits.length, 0);
    });
});
