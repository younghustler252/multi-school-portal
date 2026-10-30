/* Plain messages used by the payment webhook entry (the module's domain errors live in payment.errors.ts).
   This file was imported by handle-webhook.usecase.ts but missing, so the app container could not load. */
export const PaymentErrorMessage = {
    WEBHOOK_INVALID: "Invalid webhook signature",
} as const;

export type PaymentErrorMessageKey = keyof typeof PaymentErrorMessage;
