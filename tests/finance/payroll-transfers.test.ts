import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transfersWorld, code } from "./support/transfers-world";
import { buildReference, parseReference, checkLimits, nextStatus } from "../../src/modules/payroll-transfers/domain/transfer.policy";

const fail = (definitive: boolean, message = "boom") => ({ throw: { definitive, message } });

describe("salary transfer rules (pure)", () => {
    it("references carry the school and parse back; others are not ours", () => {
        const ref = buildReference("123e4567-e89b-12d3-a456-426614174000", "abcdef012345", 2);
        assert.match(ref, /^[a-z0-9_-]{16,50}$/);
        assert.deepEqual(parseReference(ref), { schoolKey: "123e4567e89b12d3", attempt: 2 });
        assert.equal(parseReference("PAY-ABC123"), null);
    });
    it("a late success after a failure is accepted; a failure never undoes a success; a repeat changes nothing", () => {
        assert.equal(nextStatus("FAILED", "success"), "SUCCESS");
        assert.equal(nextStatus("SUCCESS", "failed"), "REJECT");
        assert.equal(nextStatus("SUCCESS", "success"), "SAME");
        assert.equal(nextStatus("SUCCESS", "reversed"), "REVERSED");
        assert.equal(nextStatus("REVERSED", "success"), "REJECT");
    });
    it("limits: 0 is no limit; any single or batch breach refuses", () => {
        const a = [{ staffId: "a", amountKobo: 100n }, { staffId: "b", amountKobo: 300n }];
        assert.equal(checkLimits(a, 0n, 0n), null);
        assert.equal(checkLimits(a, 200n, 0n)?.code, "TRANSFER_OVER_LIMIT");
        assert.equal(checkLimits(a, 0n, 350n)?.code, "BATCH_OVER_LIMIT");
    });
});

describe("salary transfers: switches, start and limits", () => {
    it("nothing runs unless the platform and the school both switch transfers on", async () => {
        const off = transfersWorld({ enabled: false }); const run = await off.approvedRun();
        await assert.rejects(off.startRun(run.id), code("TRANSFERS_DISABLED"));
        const school = transfersWorld({ settings: { payrollTransfersEnabled: false } }); const r2 = await school.approvedRun();
        await assert.rejects(school.startRun(r2.id), code("TRANSFERS_DISABLED"));
    });

    it("start creates one pending transfer per payslip and sends nothing; starting again makes no duplicates", async () => {
        const t = transfersWorld(); const run = await t.approvedRun();
        const r = await t.startRun(run.id);
        assert.equal(r.started, 2);
        assert.deepEqual(t.statuses(), ["PENDING", "PENDING"]);
        assert.equal(t.provider.calls.length, 0);
        await assert.rejects(t.startRun(run.id), code("NOTHING_TO_SEND"));
        assert.equal(t.transfers.size, 2);
        assert.ok(![...t.transfers.values()].some(x => /[A-Z]/.test(x.reference)));
    });

    it("the approver cannot also send, unless the school allows self approval; the run must be approved", async () => {
        const t = transfersWorld(); const run = await t.approvedRun();
        await assert.rejects(t.startRun(run.id, "principal-1"), code("INITIATOR_IS_APPROVER"));
        const open = transfersWorld({ settings: { allowSelfApproval: true } }); const r2 = await open.approvedRun();
        await open.startRun(r2.id, "principal-1");
        const draft = await t.w.calculated({ periodMonth: 8, payDate: "2026-08-28" });
        await assert.rejects(t.startRun(draft.id), code("RUN_NOT_APPROVED"));
    });

    it("someone with no bank details is skipped and reported, and limits refuse the whole start", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); t.bank.delete("s2");
        const r = await t.startRun(run.id);
        assert.equal(r.started, 1); assert.equal(r.skipped[0].staffId, "s2");
        const lim = transfersWorld({ settings: { transferBatchMaxKobo: 1n } }); const r2 = await lim.approvedRun();
        await assert.rejects(lim.startRun(r2.id), code("BATCH_OVER_LIMIT"));
        assert.equal(lim.transfers.size, 0);
    });

    it("a profile edit after starting cannot redirect the money: the bank details are frozen on the transfer", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        const before = [...t.transfers.values()].map(x => x.accountNumberEncrypted);
        t.details("s1", { accountNumberEncrypted: "enc:9999999999", accountLast4: "9999" });
        await t.sendRun(run.id, "bursar-1");
        assert.deepEqual(t.provider.recipients.map((r: any) => r.accountNumber).sort(), before.map(b => b.replace("enc:", "")).sort());
    });
});

describe("salary transfers: sending and confirming", () => {
    it("accepted -> PROCESSING; paid is only booked when the provider confirms; the run is PAID when everyone is", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        const sent = await t.sendRun(run.id);
        assert.deepEqual(sent.results.map((r: any) => r.status), ["PROCESSING", "PROCESSING"]);
        assert.equal(t.w.balance("a-bank"), 0n, "nothing booked until the provider confirms");
        const [a, b] = [...t.transfers.values()];
        await t.events.execute("school-1", "transfer.success", { reference: a.reference, transfer_code: "TRF_x" });
        assert.equal(t.transfers.get(a.id).status, "SUCCESS");
        assert.equal(t.w.runs.get(run.id).status, "APPROVED", "one of two paid: the run is not paid yet");
        await t.events.execute("school-1", "transfer.success", { reference: b.reference });
        assert.equal(t.w.runs.get(run.id).status, "PAID");
        assert.equal(t.w.balance("a-spay"), 0n);
        assert.equal(t.w.balance("a-bank"), -(a.amountKobo + b.amountKobo));
    });

    it("the same webhook twice books once", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id); await t.sendRun(run.id);
        const a = [...t.transfers.values()][0], journals = t.w.books.journals.length;
        await t.events.execute("school-1", "transfer.success", { reference: a.reference });
        const again = await t.events.execute("school-1", "transfer.success", { reference: a.reference });
        assert.equal((again as any).result, "same");
        assert.equal(t.w.books.journals.length, journals + 1);
    });

    it("an instant success from the provider is booked straight away", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        t.provider.script.push({ state: "success" }, { state: "success" });
        await t.sendRun(run.id);
        assert.deepEqual(t.statuses(), ["SUCCESS", "SUCCESS"]);
        assert.equal(t.w.runs.get(run.id).status, "PAID");
    });

    it("a refusal is a failure with nothing booked, and a retry is a NEW attempt with a new reference", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        t.provider.script.push(fail(true, "Account number is invalid"), { state: "pending" });
        await t.sendRun(run.id);
        const failed = [...t.transfers.values()].find(x => x.status === "FAILED")!;
        assert.match(failed.failureReason, /invalid/);
        assert.equal(t.w.books.journals.filter((j: any) => j.sourceType === "PAYROLL_PAYMENT").length, 0);
        const r: any = await t.retry.execute(failed.id, "school-1", "bursar-1", {});
        assert.equal(r.attempt, 2);
        assert.notEqual(r.reference, failed.reference);
        await assert.rejects(t.retry.execute(failed.id, "school-1", "bursar-1", {}), code("TRANSFER_ALREADY_LIVE"));
    });

    it("a timeout is UNKNOWN: it is never sent again, only verified", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        t.provider.script.push(fail(false, "timeout"), { state: "pending" });
        await t.sendRun(run.id);
        const unknown = [...t.transfers.values()].find(x => x.status === "UNKNOWN")!;
        const calls = t.provider.calls.length;
        await t.sendRun(run.id);                                       // sending again must not resend the unknown one
        assert.equal(t.provider.calls.length, calls);
        await assert.rejects(t.retry.execute(unknown.id, "school-1", "bursar-1", {}), code("TRANSFER_NOT_RETRYABLE"));
        t.provider.remote.set(unknown.reference, { state: "success", transferCode: "TRF_ok" });
        const r = await t.reconcile.execute("school-1", "bursar-1", { transferId: unknown.id });
        assert.equal(r.results[0].after, "SUCCESS");
        assert.equal(t.w.books.journals.filter((j: any) => j.sourceType === "PAYROLL_PAYMENT").length, 1);
    });

    it("'no record' at the provider is trusted only after a wait", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        t.provider.script.push(fail(false, "timeout"), { state: "pending" });
        await t.sendRun(run.id);
        const u = [...t.transfers.values()].find(x => x.status === "UNKNOWN")!;
        u.sentAt = new Date("2026-10-20T09:50:00Z");                  // 10 minutes before "now"
        assert.equal((await t.reconcile.execute("school-1", "u", { transferId: u.id })).results[0].after, "UNKNOWN");
        u.sentAt = new Date("2026-10-20T08:00:00Z");
        assert.equal((await t.reconcile.execute("school-1", "u", { transferId: u.id })).results[0].after, "FAILED");
    });

    it("'duplicate reference' from the provider means it already has the transfer: unknown, not failed", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        t.provider.script.push(fail(true, "Duplicate Transfer Reference"), { state: "pending" });
        await t.sendRun(run.id);
        assert.ok(t.statuses().includes("UNKNOWN"));
        assert.ok(!t.statuses().includes("FAILED"));
    });

    it("a recipient set-up that cannot reach the provider puts the transfer back, nothing sent", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        const orig = t.provider.createRecipient; let first = true;
        t.provider.createRecipient = async (p: any) => { if (first) { first = false; throw new (await import("../../src/infrastructure/payments/interfaces/payment.provider.interface")).PaymentProviderError("offline", false); } return orig(p); };
        await t.sendRun(run.id);
        assert.ok(t.statuses().includes("PENDING"));
        assert.equal(t.provider.calls.length, 1);
    });
});

describe("salary transfers: odd events and the books", () => {
    it("reversed before success books the payment then reverses it; a later success cannot revive it", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id); await t.sendRun(run.id);
        const a = [...t.transfers.values()][0];
        await t.events.execute("school-1", "transfer.reversed", { reference: a.reference, reason: "Account closed" });
        assert.equal(t.transfers.get(a.id).status, "REVERSED");
        assert.equal(t.w.balance("a-bank"), 0n);
        const late: any = await t.events.execute("school-1", "transfer.success", { reference: a.reference });
        assert.equal(late.result, "rejected");
        assert.equal(t.transfers.get(a.id).status, "REVERSED");
        assert.ok(t.audit.some((x: any) => x.action === "payroll.transfer.conflict"));
    });

    it("a failure after a success changes nothing but is recorded", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        t.provider.script.push({ state: "success" }, { state: "pending" });
        await t.sendRun(run.id);
        const paid = [...t.transfers.values()].find(x => x.status === "SUCCESS")!;
        const r: any = await t.events.execute("school-1", "transfer.failed", { reference: paid.reference });
        assert.equal(r.result, "rejected"); assert.equal(t.transfers.get(paid.id).status, "SUCCESS");
    });

    it("a late success after a failure is accepted and flagged", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        t.provider.script.push(fail(true, "refused"), { state: "pending" });
        await t.sendRun(run.id);
        const f = [...t.transfers.values()].find(x => x.status === "FAILED")!;
        await t.events.execute("school-1", "transfer.success", { reference: f.reference });
        assert.equal(t.transfers.get(f.id).status, "SUCCESS");
        assert.ok(t.audit.some((x: any) => x.action === "payroll.transfer.late_success"));
    });

    it("an event for a reference we do not know is ignored", async () => {
        const t = transfersWorld();
        assert.deepEqual(await t.events.execute("school-1", "transfer.success", { reference: "sal-0000000000000000-aaaaaaaaaaaa-1" }), { handled: false });
    });

    it("a run with transfers started cannot also be paid by hand, and a pending transfer can be cancelled", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        await assert.rejects(t.w.payRun(run.id), code("RUN_HAS_TRANSFERS"));
        const a = [...t.transfers.values()][0];
        await t.cancel.execute(a.id, "school-1", "bursar-1");
        assert.equal(t.transfers.get(a.id).status, "CANCELLED");
        await t.sendRun(run.id);
        await assert.rejects(t.cancel.execute(a.id, "school-1", "bursar-1"), code("TRANSFER_NOT_CANCELLABLE"));
    });

    it("the books balance after a mix of outcomes", async () => {
        const t = transfersWorld(); const run = await t.approvedRun(); await t.startRun(run.id);
        t.provider.script.push({ state: "success" }, fail(true, "refused"));
        await t.sendRun(run.id);
        const sums = t.w.books.journals.reduce((s: any, j: any) => ({ d: s.d + j.lines.reduce((x: bigint, l: any) => x + l.debitKobo, 0n), c: s.c + j.lines.reduce((x: bigint, l: any) => x + l.creditKobo, 0n) }), { d: 0n, c: 0n });
        assert.equal(sums.d, sums.c);
    });
});
