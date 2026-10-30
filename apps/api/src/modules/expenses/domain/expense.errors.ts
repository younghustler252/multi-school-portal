import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the expenses module builds domain errors. Codes are stable; the frontend switches on them. */
export const expenseErrors = {
    // not found
    expenseNotFound:   () => new NotFoundError("Expense"),
    vendorNotFound:    () => new NotFoundError("Vendor"),
    paymentNotFound:   () => new NotFoundError("Expense payment"),
    budgetNotFound:    () => new NotFoundError("Budget"),
    recurringNotFound: () => new NotFoundError("Recurring expense"),

    // vendors
    vendorInactive:    (name: string) => new AppError(`${name} is not active`, 400, true, "VENDOR_INACTIVE", { vendor: name }),
    vendorInUse:       () => new AppError("This vendor has expenses. Deactivate it instead of deleting it", 409, true, "VENDOR_IN_USE"),
    vendorRequired:    () => new AppError("A bill must say which supplier it is owed to", 400, true, "VENDOR_REQUIRED"),
    accountNumberInvalid: () => new AppError("The bank account number must be 10 digits", 400, true, "ACCOUNT_NUMBER_INVALID"),

    // building an expense
    expenseDateFuture: (day: string, today: string) => new AppError("An expense cannot be dated in the future", 400, true, "EXPENSE_DATE_IN_FUTURE", { day, today }),
    dueBeforeExpense:  () => new AppError("The due date cannot be before the expense date", 400, true, "DUE_BEFORE_EXPENSE"),
    expenseAccountInvalid: (message: string, accountId?: string) => new AppError(message, 400, true, "EXPENSE_ACCOUNT_INVALID", accountId ? { accountId } : undefined),
    payAccountInvalid: (message: string) => new AppError(message, 400, true, "PAYMENT_ACCOUNT_INVALID"),
    payAccountRequired: () => new AppError("Choose the cash or bank account this expense is paid from", 400, true, "PAY_ACCOUNT_REQUIRED"),
    vatNotEnabled:     () => new AppError("VAT is not switched on for this school. Turn on \"Track VAT on expenses\" in finance settings first", 400, true, "VAT_NOT_ENABLED"),
    expenseEmpty:      () => new AppError("An expense needs at least one line above zero", 400, true, "EXPENSE_HAS_NO_LINES"),
    refNotFound:       (what: string) => new AppError(`${what} does not exist`, 400, true, "REFERENCE_NOT_FOUND", { what }),

    // states and approval
    notEditable:       (status: string) => new AppError("Only a draft or a rejected expense can be changed or deleted", 409, true, "EXPENSE_NOT_EDITABLE", { status }),
    notSubmittable:    (status: string) => new AppError("Only a draft expense can be submitted", 409, true, "EXPENSE_NOT_DRAFT", { status }),
    notPending:        (status: string) => new AppError("This expense is not waiting for a decision", 409, true, "EXPENSE_NOT_PENDING", { status }),
    secondApproverMustDiffer: () => new AppError("A second, different person must approve this expense", 403, true, "SECOND_APPROVER_MUST_DIFFER"),
    selfApproval:      () => new AppError("You cannot approve or reject an expense you requested", 403, true, "SELF_APPROVAL_NOT_ALLOWED"),
    rejectionReasonRequired: () => new AppError("Say why the expense is rejected", 400, true, "REASON_REQUIRED"),
    expenseChanged:    () => new AppError("Someone else changed this expense. Reload it and try again", 409, true, "STALE_VERSION"),
    budgetExceeded:    (details: Record<string, unknown>) => new AppError("This would take spending over the budget", 409, true, "BUDGET_EXCEEDED", details),

    // paying
    notPayable:        (status: string) => new AppError("Only an approved bill that still owes money can be paid", 409, true, "EXPENSE_NOT_PAYABLE", { status }),
    directNotPayable:  () => new AppError("A direct expense is paid when it is approved", 409, true, "DIRECT_EXPENSE_PAID_ON_APPROVAL"),
    billOverpayment:   (balanceKobo: bigint) => new AppError("That is more than the bill still owes", 400, true, "BILL_OVERPAYMENT", { balanceKobo: balanceKobo.toString() }),
    paymentDateFuture: (day: string, today: string) => new AppError("A payment cannot be dated in the future", 400, true, "PAYMENT_DATE_IN_FUTURE", { day, today }),
    paymentBeforeExpense: () => new AppError("A payment cannot be dated before the bill", 400, true, "PAYMENT_BEFORE_EXPENSE"),
    paymentAlreadyReversed: () => new AppError("This payment was already reversed", 409, true, "PAYMENT_ALREADY_REVERSED"),
    reverseDirect:     () => new AppError("A direct expense has one payment. Void the expense instead", 409, true, "REVERSE_DIRECT_NOT_ALLOWED"),
    notVoidable:       (status: string) => new AppError("Only an approved, part-paid or paid expense can be voided", 409, true, "EXPENSE_NOT_VOIDABLE", { status }),

    // budgets
    budgetDates:       () => new AppError("The budget must end on or after the day it starts", 400, true, "BUDGET_DATES_INVALID"),
    budgetClosed:      () => new AppError("A closed budget cannot be changed", 409, true, "BUDGET_CLOSED"),
    budgetLineAccount: (message: string) => new AppError(message, 400, true, "BUDGET_ACCOUNT_INVALID"),
    budgetLineDuplicate: () => new AppError("An account can appear once per term on a budget", 400, true, "BUDGET_LINE_DUPLICATE"),
    budgetNeedsLines:  () => new AppError("Add at least one line before activating a budget", 400, true, "BUDGET_HAS_NO_LINES"),
    budgetStatus:      (status: string) => new AppError("That is not allowed for a budget in this state", 409, true, "BUDGET_STATE", { status }),

    // recurring
    recurringInvalid:  (message: string) => new AppError(message, 400, true, "RECURRING_INVALID"),
};
