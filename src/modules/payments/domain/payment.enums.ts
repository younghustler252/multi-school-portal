export enum PaymentMethod {
    PAYSTACK      = "paystack",
    FLUTTERWAVE   = "flutterwave",
    BANK_TRANSFER = "bank_transfer",
    CASH          = "cash",
}

export enum PaymentStatus {
    PENDING  = "pending",
    SUCCESS  = "success",
    FAILED   = "failed",
    REFUNDED = "refunded",
}

export enum PaymentErrorMessage {
    NOT_FOUND        = "Payment not found",
    INVOICE_NOT_FOUND = "Invoice not found",
    ALREADY_PAID     = "This invoice is already fully paid",
    INVALID_AMOUNT   = "Payment amount exceeds outstanding balance",
    WEBHOOK_INVALID  = "Invalid webhook signature",
}