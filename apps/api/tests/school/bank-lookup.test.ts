import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as C from "../../../../packages/contracts/src";
import { ListBanksUseCase, VerifyBankAccountUseCase, resetBankListCache } from "../../src/modules/school/usecases/bank-lookup.usecases";
import { accountNameMatchesSchool } from "../../src/modules/school/domain/account-name";
import { VerifyBankAccountDto } from "../../src/modules/school/dtos/school.dto";
import { PaymentProviderError } from "../../src/infrastructure/payments/interfaces/payment.provider.interface";

const banks = [{ name: "Zenith Bank", code: "057" }, { name: "Access Bank", code: "044" }, { name: "Access Bank (dup)", code: "044" }, { name: "", code: "999" }];
const school = { id: "s1", name: "Greenfield Royal Academy" };

describe("bank list", () => {
    beforeEach(() => resetBankListCache());

    it("returns {name, code} sorted by name, drops blanks and repeated codes", async () => {
        const uc = new ListBanksUseCase({ paymentProvider: { listBanks: async () => banks, verifyAccountNumber: async () => ({ accountName: "" }) } });
        assert.deepEqual(await uc.execute(), [{ name: "Access Bank", code: "044" }, { name: "Zenith Bank", code: "057" }]);
    });
    it("keeps the list for a day, then asks the provider again", async () => {
        let calls = 0, t = 1_000;
        const uc = new ListBanksUseCase({ paymentProvider: { listBanks: async () => { calls++; return banks; }, verifyAccountNumber: async () => ({ accountName: "" }) } }, () => t);
        await uc.execute(); await uc.execute();
        assert.equal(calls, 1);
        t += 24 * 60 * 60 * 1000 + 1;
        await uc.execute();
        assert.equal(calls, 2);
    });
    it("never caches a failure and reports an unknown outcome as 503 BANK_LOOKUP_UNAVAILABLE", async () => {
        let fail = true, calls = 0;
        const uc = new ListBanksUseCase({ paymentProvider: { listBanks: async () => { calls++; if (fail) throw new PaymentProviderError("timeout", false); return banks; }, verifyAccountNumber: async () => ({ accountName: "" }) } });
        await assert.rejects(uc.execute(), (e: any) => e.statusCode === 503 && e.code === "BANK_LOOKUP_UNAVAILABLE");
        fail = false;
        assert.equal((await uc.execute()).length, 2);
        assert.equal(calls, 2);
    });
});

describe("account verification preview", () => {
    const build = (verify: (n: string, b: string) => Promise<{ accountName: string }>, found = true) =>
        new VerifyBankAccountUseCase({ schoolRepository: { findById: async () => (found ? school : null) } as any, paymentProvider: { listBanks: async () => [], verifyAccountNumber: verify } });

    it("returns the account name and whether it matches the school, and nothing else", async () => {
        const r = await build(async () => ({ accountName: "GREENFIELD ROYAL ACADEMY LTD" })).execute("s1", { bankCode: "058", accountNumber: "0123456789" });
        assert.deepEqual(r, { accountName: "GREENFIELD ROYAL ACADEMY LTD", accountNameMatchesSchool: true });
        const other = await build(async () => ({ accountName: "ADA OBI" })).execute("s1", { bankCode: "058", accountNumber: "0123456789" });
        assert.equal(other.accountNameMatchesSchool, false);
    });
    it("passes the number and bank to the provider in the right order", async () => {
        let seen: string[] = [];
        await build(async (n, b) => { seen = [n, b]; return { accountName: "X" }; }).execute("s1", { bankCode: "058", accountNumber: "0123456789" });
        assert.deepEqual(seen, ["0123456789", "058"]);
    });
    it("a definite 'no' from the bank is the same 400 payment-setup gives", async () => {
        for (const status of [400, 404, 422]) {
            await assert.rejects(build(async () => { throw new PaymentProviderError("Could not resolve", true, status); }).execute("s1", { bankCode: "058", accountNumber: "0123456789" }),
                (e: any) => e.statusCode === 400 && /verify bank account/i.test(e.message));
        }
    });
    it("an unknown outcome, or our own key being rejected, is 503 so the person retries instead of fixing a correct number", async () => {
        const run = (err: unknown) => build(async () => { throw err; }).execute("s1", { bankCode: "058", accountNumber: "0123456789" });
        await assert.rejects(run(new PaymentProviderError("timeout", false)), (e: any) => e.statusCode === 503);
        await assert.rejects(run(new PaymentProviderError("bad key", true, 401)), (e: any) => e.statusCode === 503);
        await assert.rejects(run(new Error("boom")), (e: any) => e.statusCode === 503);
    });
    it("unknown school is 404 and the provider is not called", async () => {
        let called = false;
        await assert.rejects(build(async () => { called = true; return { accountName: "x" }; }, false).execute("nope", { bankCode: "058", accountNumber: "0123456789" }), (e: any) => e.statusCode === 404);
        assert.equal(called, false);
    });
});

describe("name matching rule shared with payment-setup", () => {
    it("ignores case, punctuation and words of two letters or fewer", () => {
        assert.equal(accountNameMatchesSchool("St. Mary's College", "ST MARYS COLLEGE LTD"), true);
        assert.equal(accountNameMatchesSchool("Greenfield Academy", "OK ME"), false);
        assert.equal(accountNameMatchesSchool("AB CD", "AB CD"), false);
    });
});

describe("verify request contract", () => {
    const samples = [{}, { bankCode: "058", accountNumber: "0123456789" }, { bankCode: "5", accountNumber: "0123456789" }, { bankCode: "01234567890", accountNumber: "0123456789" },
        { bankCode: "058", accountNumber: "123" }, { bankCode: "058", accountNumber: "01234567890" }, { bankCode: "058", accountNumber: "01234abcde" }, { bankCode: " 058 ", accountNumber: "0123456789" },
        { bankCode: "058", accountNumber: "0123456789", password: "x" }, { bankCode: "058", accountNumber: 123456789 }];
    it("the shared schema and the API DTO accept and refuse the same inputs", () => {
        const wrong = samples.filter(s => C.VerifyBankAccountRequest.safeParse(s).success !== VerifyBankAccountDto.safeParse(s).success);
        assert.deepEqual(wrong, []);
    });
    it("no password is accepted on the preview", () => assert.equal(VerifyBankAccountDto.safeParse({ bankCode: "058", accountNumber: "0123456789", password: "x" }).success, false));
});
