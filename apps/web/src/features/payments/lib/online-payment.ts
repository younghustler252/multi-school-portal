import { compareKobo, koboForRequest, nairaToKobo, type Kobo } from "@/lib/money";
import { isApiError } from "@/lib/api/api-error";
import type { OnlinePaymentState } from "../types/payment-contract.types";

/* Pure rules for paying online (the screens call these; nothing here touches the network). */

export type AmountCheck = { ok: true; amountKobo: Kobo | undefined } | { ok: false; message: string };

/*
| What the guardian typed to pay. Blank or exactly the balance means "pay it all": nothing is sent and the server uses the
| balance. A part payment is whole kobo, above zero, and not above what is owed.
*/
export function checkPayAmount(input: string, balanceKobo: Kobo): AmountCheck {
	if (input.trim() === "") return { ok: true, amountKobo: undefined };
	const typed = nairaToKobo(input);
	if (typed === null) return { ok: false, message: "Enter an amount in naira, like 25,000 or 25,000.50." };
	if (typed <= 0n) return { ok: false, message: "The amount must be more than zero." };
	if (compareKobo(typed.toString(), balanceKobo) > 0) return { ok: false, message: "That is more than the balance on this invoice." };
	if (compareKobo(typed.toString(), balanceKobo) === 0) return { ok: true, amountKobo: undefined };
	return { ok: true, amountKobo: koboForRequest(typed) };
}

/** The gateway sends the guardian back with `?reference=` (Paystack also adds `trxref`). */
export function returnReference(params: { get(name: string): string | null }): string | null {
	const ref = params.get("reference") ?? params.get("trxref");
	return ref && /^[A-Za-z0-9_-]{4,100}$/.test(ref) ? ref : null;
}

/** Where the gateway should send the guardian back to: the payments page of this same host. */
export const returnUrl = (origin: string, path: string): string => `${origin}${path}`;

export interface OutcomeText { tone: "success" | "waiting" | "failure"; title: string; body: string }

export function outcomeText(state: OnlinePaymentState): OutcomeText {
	switch (state) {
		case "confirmed": return { tone: "success", title: "Payment received", body: "Thank you. Your receipt is ready below." };
		case "already": return { tone: "success", title: "Payment already confirmed", body: "This payment was confirmed earlier. Nothing more to do." };
		case "pending": return { tone: "waiting", title: "Waiting for the bank", body: "The bank hasn't finished yet. This can take a minute. If you were charged, your payment will show here once it clears." };
		case "failed": return { tone: "failure", title: "Payment was not completed", body: "You were not charged for this attempt. You can try again from the invoice." };
	}
}

/*
| A failed call, in words a parent can act on. Codes are the backend's (payments module).
| A network fault or server error while CHECKING a payment is never "it failed": the money may have gone through,
| so the message says to check again.
*/
export function startPaymentError(err: unknown): string {
	if (isApiError(err)) {
		switch (err.code) {
			case "INVOICE_NOT_PAYABLE": return "This invoice can't be paid online right now. It may already be paid. Refresh the page.";
			case "NOT_YOUR_CHILD": return "That invoice doesn't belong to one of your children.";
			case "GATEWAY_ERROR": return "The payment service couldn't start the payment. Nothing was charged. Please try again.";
			case "PAYMENT_ACCOUNT_INVALID": return "The school hasn't finished setting up online payments yet. Please contact the school.";
			case "FEATURE_NOT_AVAILABLE": return "Online payment isn't available for this school.";
		}
		if (err.status === 429) return "Too many attempts. Please wait a minute and try again.";
		if (err.status !== null && err.status >= 400 && err.status < 500) return err.message;
	}
	return "Couldn't start the payment. Nothing was charged. Please try again.";
}

export function verifyPaymentError(err: unknown): { message: string; retryable: boolean } {
	if (isApiError(err)) {
		if (err.code === "NOT_YOUR_PAYMENT") return { message: "That payment isn't linked to your account.", retryable: false };
		if (err.code === "ONLINE_AMOUNT_MISMATCH") return { message: "The bank reported a different amount from the one you were asked to pay. The school has been alerted and will check it. Please don't pay again.", retryable: false };
		if (err.status === 404) return { message: "We couldn't find that payment.", retryable: false };
	}
	return { message: "We couldn't check the payment just now. If you were charged, it will show up here shortly. Try again in a moment.", retryable: true };
}
