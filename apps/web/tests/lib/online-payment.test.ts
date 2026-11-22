import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/api-error";
import { checkPayAmount, outcomeText, returnReference, startPaymentError, verifyPaymentError } from "@/features/payments/lib/online-payment";

const err = (code: string, status: number | null, message = "server said") => new ApiError({ message, status, code });

describe("checkPayAmount", () => {
	it("blank or the exact balance means pay it all (nothing is sent)", () => {
		expect(checkPayAmount("", 250000)).toEqual({ ok: true, amountKobo: undefined });
		expect(checkPayAmount("   ", 250000)).toEqual({ ok: true, amountKobo: undefined });
		expect(checkPayAmount("2,500", 250000)).toEqual({ ok: true, amountKobo: undefined });
	});
	it("a part payment is sent as whole kobo", () => {
		expect(checkPayAmount("1,000", 250000)).toEqual({ ok: true, amountKobo: 100000 });
		expect(checkPayAmount("1000.50", 250000)).toEqual({ ok: true, amountKobo: 100050 });
	});
	it("refuses zero, text, too many decimals and more than the balance", () => {
		for (const bad of ["0", "0.00", "abc", "12.345", "-5"]) expect(checkPayAmount(bad, 250000).ok).toBe(false);
		const over = checkPayAmount("2,500.01", 250000);
		expect(over.ok).toBe(false);
	});
	it("works for balances past 2^53 (digit strings)", () => {
		expect(checkPayAmount("", "9007199254740993")).toEqual({ ok: true, amountKobo: undefined });
		expect(checkPayAmount("1", "9007199254740993")).toEqual({ ok: true, amountKobo: 100 });
	});
});

describe("returnReference", () => {
	const params = (q: Record<string, string>) => ({ get: (k: string) => q[k] ?? null });
	it("reads reference, then trxref", () => {
		expect(returnReference(params({ reference: "PAY-AB12CD34EF56" }))).toBe("PAY-AB12CD34EF56");
		expect(returnReference(params({ trxref: "PAY-AB12CD34EF56" }))).toBe("PAY-AB12CD34EF56");
	});
	it("ignores anything that does not look like a reference", () => {
		expect(returnReference(params({}))).toBeNull();
		expect(returnReference(params({ reference: "../../etc" }))).toBeNull();
		expect(returnReference(params({ reference: "<script>" }))).toBeNull();
		expect(returnReference(params({ reference: "ab" }))).toBeNull();
	});
});

describe("outcomeText", () => {
	it("covers every state with the right tone", () => {
		expect(outcomeText("confirmed").tone).toBe("success");
		expect(outcomeText("already").tone).toBe("success");
		expect(outcomeText("pending").tone).toBe("waiting");
		expect(outcomeText("failed").tone).toBe("failure");
	});
	it("a failed attempt says the person was not charged; a pending one does not claim failure", () => {
		expect(outcomeText("failed").body).toContain("not charged");
		expect(outcomeText("pending").title.toLowerCase()).not.toContain("fail");
	});
});

describe("error wording", () => {
	it("start: known codes get a plain message", () => {
		expect(startPaymentError(err("INVOICE_NOT_PAYABLE", 409))).toContain("can't be paid online");
		expect(startPaymentError(err("GATEWAY_ERROR", 502))).toContain("Nothing was charged");
		expect(startPaymentError(err("PAYMENT_ACCOUNT_INVALID", 400))).toContain("school");
		expect(startPaymentError(err("X", 429))).toContain("Too many");
	});
	it("start: a network fault or 500 never leaks internals", () => {
		expect(startPaymentError(err("UNKNOWN", 500, "stack trace"))).not.toContain("stack trace");
		expect(startPaymentError(new Error("boom"))).toContain("Nothing was charged");
	});
	it("verify: server faults are retryable and never say 'failed'", () => {
		const r = verifyPaymentError(err("UNKNOWN", 500));
		expect(r.retryable).toBe(true);
		expect(r.message.toLowerCase()).not.toContain("failed");
		expect(verifyPaymentError(new Error("offline")).retryable).toBe(true);
	});
	it("verify: ownership, mismatch and unknown reference are final", () => {
		expect(verifyPaymentError(err("NOT_YOUR_PAYMENT", 403)).retryable).toBe(false);
		const m = verifyPaymentError(err("ONLINE_AMOUNT_MISMATCH", 409));
		expect(m.retryable).toBe(false);
		expect(m.message).toContain("don't pay again");
		expect(verifyPaymentError(err("NOT_FOUND", 404)).retryable).toBe(false);
	});
});
