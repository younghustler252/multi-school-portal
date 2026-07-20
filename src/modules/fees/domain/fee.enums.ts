export enum InvoiceStatus {
    UNPAID  = "unpaid",
    PARTIAL = "partial",
    PAID    = "paid",
    WAIVED  = "waived",
}

export enum FeeErrorMessage {
    FEE_TYPE_NOT_FOUND    = "Fee type not found",
    FEE_TYPE_NAME_TAKEN   = "A fee type with this name already exists",
    INVOICE_NOT_FOUND     = "Fee invoice not found",
    STUDENT_NOT_FOUND     = "Student not found",
    ALREADY_INVOICED      = "Student already has an invoice for this fee type this term",
    OVERPAYMENT           = "Payment amount exceeds outstanding balance",
}