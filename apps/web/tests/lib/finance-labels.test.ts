import { describe, expect, it } from "vitest";
import { formatDay, INVOICE_STATUS_BADGE, INVOICE_STATUS_TEXT } from "@/features/fees/lib/finance-labels";
import { paymentMethodText, PAYMENT_STATUS_BADGE, PAYMENT_STATUS_TEXT } from "@/features/payments/lib/payment-labels";

describe("finance labels", () => {
	it("every invoice status has a label and a badge", () => {
		for (const s of ["draft", "unpaid", "partial", "paid", "waived", "void"] as const) {
			expect(INVOICE_STATUS_TEXT[s]).toBeTruthy();
			expect(INVOICE_STATUS_BADGE[s]).toBeTruthy();
		}
	});
	it("every payment status has a label and a badge", () => {
		for (const s of ["PENDING", "AWAITING_CONFIRMATION", "CONFIRMED", "FAILED", "REVERSED"] as const) {
			expect(PAYMENT_STATUS_TEXT[s]).toBeTruthy();
			expect(PAYMENT_STATUS_BADGE[s]).toBeTruthy();
		}
	});
	it("an unknown payment method still reads", () => {
		expect(paymentMethodText("pos")).toBe("POS");
		expect(paymentMethodText("mobile_money")).toBe("mobile money");
	});
	it("formatDay keeps the calendar day whatever the timezone", () => {
		expect(formatDay("2026-11-05")).toBe("5 Nov 2026");
		expect(formatDay(null)).toBe("—");
		expect(formatDay("nonsense")).toBe("—");
	});
});
