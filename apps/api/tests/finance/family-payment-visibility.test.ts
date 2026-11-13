import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { receiptForGuardian, shareForStudents } from "../../src/modules/payments/services/family-payment-visibility";

const base = (over: any = {}): any => ({
    receiptNumber: "R1", issuedAt: "2026-02-10T09:00:00.000Z", paidOn: "2026-02-10",
    school: { name: "S", address: null, logoUrl: null, principalName: null },
    payer: { type: "GUARDIAN", name: "Payer", phone: "0800" }, method: "cash", reference: "REF", amountKobo: "150",
    lines: [{ invoiceNumber: "I1", studentId: "mine", studentName: "Mine", amountKobo: "100", balanceAfterKobo: "0" }, { invoiceNumber: "I2", studentId: "other", studentName: "Other", amountKobo: "30", balanceAfterKobo: "5" }],
    credit: { studentId: "other", studentName: "Other", amountKobo: "20" }, ...over,
});
const mine = new Set(["mine"]);

describe("receiptForGuardian", () => {
    it("payer: whole total; other students only as one anonymous amount (lines AND credit)", () => {
        const r = receiptForGuardian(base(), { isPayer: true, childIds: mine, status: "CONFIRMED" })!;
        assert.equal(r.amountKobo, "150"); assert.deepEqual(r.otherStudents, { amountKobo: "50" }); assert.equal(r.credit, null);
        assert.deepEqual(r.lines.map(l => l.studentId), ["mine"]);
        assert.ok(!JSON.stringify(r).includes("Other") && !JSON.stringify(r).includes("I2"));
    });
    it("non-payer: only their share, no other lines or credit, no phone or reference", () => {
        const r = receiptForGuardian(base(), { isPayer: false, childIds: mine, status: "CONFIRMED" })!;
        assert.equal(r.amountKobo, "100"); assert.equal(r.partial, true); assert.equal(r.otherStudents, null);
        assert.equal(r.payer.phone, null); assert.equal(r.reference, null); assert.equal(r.credit, null);
    });
    it("credit for the guardian's own child is kept and counted in their share", () => {
        const r = receiptForGuardian(base({ credit: { studentId: "mine", studentName: "Mine", amountKobo: "20" } }), { isPayer: false, childIds: mine, status: "CONFIRMED" })!;
        assert.equal(r.amountKobo, "120"); assert.equal(r.credit?.amountKobo, "20");
    });
    it("not the payer and no child on it: nothing (null)", () => {
        assert.equal(receiptForGuardian(base(), { isPayer: false, childIds: new Set(["stranger"]), status: "CONFIRMED" }), null);
        assert.equal(receiptForGuardian(base(), { isPayer: false, childIds: new Set(), status: "CONFIRMED" }), null);
    });
    it("a payer with none of their own children on it still gets the receipt, all other students anonymous", () => {
        const r = receiptForGuardian(base(), { isPayer: true, childIds: new Set(), status: "CONFIRMED" })!;
        assert.equal(r.lines.length, 0); assert.deepEqual(r.otherStudents, { amountKobo: "150" }); assert.equal(r.amountKobo, "150");
    });
    it("a damaged amount counts as zero rather than breaking the receipt", () => {
        const r = receiptForGuardian(base({ lines: [{ invoiceNumber: "I1", studentId: "mine", studentName: "Mine", amountKobo: "oops", balanceAfterKobo: "0" }], credit: null }), { isPayer: false, childIds: mine, status: "CONFIRMED" })!;
        assert.equal(r.amountKobo, "0");
    });
    it("shareForStudents adds only the given students", () => {
        assert.equal(shareForStudents([{ studentId: "a", amountKobo: 5n }, { studentId: "b", amountKobo: 7n }, { studentId: "a", amountKobo: 1n }], new Set(["a"])), 6n);
    });
});
