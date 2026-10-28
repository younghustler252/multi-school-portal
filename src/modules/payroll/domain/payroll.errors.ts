import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the payroll module builds domain errors. Codes are stable; the frontend switches on them.
   Money in `details` is a string of kobo. Staff names never go in details (they can reach logs). */
export const payrollErrors = {
    // not found
    componentNotFound: () => new NotFoundError("Pay component"),
    profileNotFound:   () => new NotFoundError("Pay profile"),
    runNotFound:       () => new NotFoundError("Payroll run"),
    payslipNotFound:   () => new NotFoundError("Payslip"),
    loanNotFound:      () => new NotFoundError("Staff loan"),
    remittanceNotFound: () => new NotFoundError("Remittance"),
    refNotFound:       (what: string) => new AppError(`${what} does not exist`, 400, true, "REFERENCE_NOT_FOUND", { what }),

    // components
    componentCodeTaken: (code: string) => new AppError(`The code ${code} is already used by another pay component`, 409, true, "COMPONENT_CODE_TAKEN", { code }),
    componentInvalid:  (message: string) => new AppError(message, 400, true, "COMPONENT_INVALID"),
    componentInUse:    () => new AppError("This component is on a pay profile or a payslip. Deactivate it instead of deleting it", 409, true, "COMPONENT_IN_USE"),
    componentInactive: (name: string) => new AppError(`${name} is not active`, 400, true, "COMPONENT_INACTIVE", { component: name }),
    overrideNotAllowed: (name: string) => new AppError(`${name} is banded, so it has no single value to override`, 400, true, "OVERRIDE_NOT_ALLOWED", { component: name }),

    // profiles
    profileDateInvalid: (message: string) => new AppError(message, 400, true, "PROFILE_DATE_INVALID"),
    accountNumberInvalid: () => new AppError("The bank account number must be 10 digits", 400, true, "ACCOUNT_NUMBER_INVALID"),

    // runs
    runExists:         (year: number, month: number) => new AppError(`There is already a payroll run for ${year}-${String(month).padStart(2, "0")}. Cancel it first to start another`, 409, true, "PAYROLL_RUN_EXISTS", { year, month }),
    periodFuture:      (year: number, month: number) => new AppError("A payroll run cannot be made for a month that has not started", 400, true, "PAYROLL_PERIOD_IN_FUTURE", { year, month }),
    runState:          (status: string, action: string) => new AppError(`A run that is ${status.toLowerCase().replace(/_/g, " ")} cannot be ${action}`, 409, true, "PAYROLL_RUN_STATE", { status, action }),
    notApproved:       (status: string) => new AppError("The run must be approved before it can be paid", 409, true, "PAYROLL_NOT_APPROVED", { status }),
    noStaff:           () => new AppError("No staff member has a pay profile, so there is nothing to calculate", 409, true, "PAY_PROFILE_MISSING"),
    calcProblems:      (problems: unknown[]) => new AppError("Some staff pay cannot be worked out. Fix these and calculate again", 409, true, "PAYROLL_CALC_PROBLEMS", { problems }),
    notCalculated:     () => new AppError("Calculate the run before sending it for approval", 409, true, "PAYROLL_NOT_CALCULATED"),
    secondApproverMustDiffer: () => new AppError("A second, different person must approve this payroll run", 403, true, "SECOND_APPROVER_MUST_DIFFER"),
    selfApproval:      () => new AppError("You cannot decide a payroll run you created", 403, true, "SELF_APPROVAL_NOT_ALLOWED"),
    reasonRequired:    () => new AppError("A reason is required", 400, true, "REASON_REQUIRED"),
    runChanged:        () => new AppError("The run was changed by someone else. Reload and try again", 409, true, "STALE_VERSION"),
    staleLoan:         () => new AppError("A staff loan changed since pay was calculated. Calculate the run again", 409, true, "PAYROLL_STALE_LOAN"),
    payDateInvalid:    (message: string) => new AppError(message, 400, true, "PAY_DATE_INVALID"),
    moneyAccountInvalid: (message: string) => new AppError(message, 400, true, "PAYMENT_ACCOUNT_INVALID"),

    // loans
    loanInvalid:       (message: string) => new AppError(message, 400, true, "LOAN_INVALID"),
    loanHasRepayments: () => new AppError("Repayments have already been taken from pay. A loan with repayments cannot be cancelled", 409, true, "LOAN_HAS_REPAYMENTS"),
    loanNotActive:     (status: string) => new AppError("Only an active loan can be cancelled", 409, true, "LOAN_NOT_ACTIVE", { status }),

    // remittances
    remittanceAccountInvalid: (message: string) => new AppError(message, 400, true, "REMITTANCE_ACCOUNT_INVALID"),
    remittanceReversed: () => new AppError("This remittance has already been reversed", 409, true, "REMITTANCE_ALREADY_REVERSED"),
};
