/* REM-079: secrets never reach the audit table, whatever the caller passes. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactAuditValue, REDACTED } from "../../src/modules/audit/services/audit-redaction";

describe("audit redaction", () => {
    it("removes credentials at any depth (auth, users, platform billing, payroll shapes)", () => {
        const out = redactAuditValue({
            email: "a@b.ng", password: "hunter2", passwordHash: "$2b$10$abc", newPassword: "x", otp: "123456", pin: "1234",
            auth: { accessToken: "jwt", refreshToken: "r", tokenType: "Bearer" },
            user: { id: "u1", resetToken: "t", twoFactorSecret: "s", profile: { apiKey: "k", api_key: "k2", privateKey: "p" } },
            headers: { authorization: "Bearer x", cookie: "sid=1" }, gateway: { secretKey: "sk_live", signature: "sig", webhook_secret: "w" },
            list: [{ token: "a" }, { name: "ok" }],
        });
        assert.equal(out.email, "a@b.ng"); assert.equal(out.user.id, "u1"); assert.equal(out.list[1].name, "ok");
        for (const v of [out.password, out.passwordHash, out.newPassword, out.otp, out.pin, out.auth.accessToken, out.auth.refreshToken, out.user.resetToken,
            out.user.twoFactorSecret, out.user.profile.apiKey, out.user.profile.api_key, out.user.profile.privateKey, out.headers.authorization, out.headers.cookie,
            out.gateway.secretKey, out.gateway.signature, out.gateway.webhook_secret, out.list[0].token]) assert.equal(v, REDACTED);
        assert.equal(out.auth.tokenType, "Bearer");                    // names the kind of token, holds none
        assert.ok(!JSON.stringify(out).includes("hunter2") && !JSON.stringify(out).includes("$2b$"));
    });
    it("masks bank, card and identity numbers to their last four characters (payroll / finance / guardian shapes)", () => {
        const out = redactAuditValue({ bank: { accountNumber: "0123456789", bankAccountNo: "9876543210" }, card_number: "4242424242424242", bvn: "22212345678", nin: 12345678901, accountName: "Ada" });
        assert.match(out.bank.accountNumber, /^\*+6789$/); assert.match(out.bank.bankAccountNo, /^\*+3210$/); assert.match(out.card_number, /^\*+4242$/);
        assert.match(out.bvn, /5678$/); assert.match(out.nin, /8901$/); assert.equal(out.accountName, "Ada");
        assert.ok(!JSON.stringify(out).includes("0123456789"));
    });
    it("does not over-redact: flags, counts, times and look-alike words stay", () => {
        const out = redactAuditValue({ hasPassword: true, passwordChangedAt: "2026-01-01", tokenCount: 3, otpRequired: false, shippingAddress: "x", mapping: "m", pinned: true, opinion: "o", spinning: 1 });
        assert.deepEqual(out, { hasPassword: true, passwordChangedAt: "2026-01-01", tokenCount: 3, otpRequired: false, shippingAddress: "x", mapping: "m", pinned: true, opinion: "o", spinning: 1 });
    });
    it("makes values JSON-safe without losing money: bigint -> exact string, Date -> ISO; null/undefined stay null; input is not mutated", () => {
        const input = { amountKobo: 9_007_199_254_749_999n, at: new Date("2026-11-14T00:00:00Z"), nothing: null, password: "p" };
        const out = redactAuditValue(input);
        assert.equal(out.amountKobo, "9007199254749999"); assert.equal(out.at, "2026-11-14T00:00:00.000Z"); assert.equal(out.nothing, null);
        assert.equal(input.password, "p");
        assert.equal(redactAuditValue(undefined), null); assert.equal(redactAuditValue("plain"), "plain");
        JSON.stringify(out);                                                            // would throw on a bigint
    });
    it("caps depth so a deep or self-referencing value cannot hang or overflow", () => {
        const loop: any = { a: {} }; loop.a.b = loop;
        assert.ok(JSON.stringify(redactAuditValue(loop)).includes("[TRUNCATED]"));
    });
    it("AuditService.log redacts oldValue, newValue and metadata before persisting (needs @sentry/node)", async t => {
        let AuditService: any;
        try { AuditService = (await import("../../src/modules/audit/services/audit.service")).AuditService; } catch { return t.skip("@sentry/node is not installed here"); }
        const rows: any[] = [];
        const svc = new AuditService({ auditRepository: { create: async (r: any) => { rows.push(r); } } as any });
        await svc.log({ action: "users.updated", entity: "User", entityId: "u1", userId: "admin",
            oldValue: { passwordHash: "old-hash", name: "A" }, newValue: { passwordHash: "new-hash", name: "B", bank: { accountNumber: "0123456789" } }, metadata: { otp: "999999", note: "n" } });
        const r = rows[0];
        assert.equal(r.oldValue.passwordHash, REDACTED); assert.equal(r.newValue.passwordHash, REDACTED); assert.equal(r.metadata.otp, REDACTED);
        assert.equal(r.newValue.name, "B"); assert.equal(r.metadata.note, "n"); assert.match(r.newValue.bank.accountNumber, /6789$/);
        assert.ok(!JSON.stringify(r).includes("new-hash") && !JSON.stringify(r).includes("0123456789"));
    });
    it("wiring: AuditService.log passes oldValue, newValue and metadata through redactAuditValue (static check, always runs)", async () => {
        const { readFileSync } = await import("node:fs");
        const src = readFileSync(new URL("../../src/modules/audit/services/audit.service.ts", import.meta.url), "utf8");
        assert.match(src, /oldValue:\s+redactAuditValue\(params\.oldValue\)/);
        assert.match(src, /newValue:\s+redactAuditValue\(params\.newValue\)/);
        assert.match(src, /redactAuditValue\(params\.metadata\)/);
        assert.ok(!/oldValue:\s+params\.oldValue/.test(src) && !/newValue:\s+params\.newValue/.test(src));
    });
});
