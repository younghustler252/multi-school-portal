export type PayComponentType = "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION";
export type PayCalcType = "FIXED" | "PERCENT_OF_BASIC" | "PERCENT_OF_GROSS" | "BANDED";
export type PayrollRunStatus = "DRAFT" | "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "PAID" | "CANCELLED";
export type PayslipStatus = "DRAFT" | "FINAL" | "PAID" | "VOID";
export type LoanStatus = "ACTIVE" | "CLEARED" | "CANCELLED";
export type LineKind = "BASIC" | "COMPONENT" | "LOAN";

/** A slice of the month's taxable pay and its rate. upToKobo null = no upper limit. rateBp is basis points (700 = 7.00%). */
export interface Band { upToKobo: bigint | null; rateBp: number }

export interface PayComponentEntity {
    id: string; name: string; code: string; type: PayComponentType; calcType: PayCalcType;
    defaultValue: bigint;                       // kobo for FIXED, basis points for the percent types
    bands: Band[] | null; isTaxable: boolean; isStatutory: boolean;
    expenseAccountId: string | null; liabilityAccountId: string | null; isActive: boolean; createdAt: Date;
}

export interface PayProfileComponent { id: string; componentId: string; componentName: string; componentCode: string; valueOverride: bigint | null; isActive: boolean }

export interface PayProfileEntity {
    id: string; staffId: string; effectiveFrom: Date; effectiveTo: Date | null; basicSalaryKobo: bigint; payFrequency: string;
    bankCode: string | null; bankName: string | null; accountName: string | null; accountNumberLast4: string | null; hasAccountNumber: boolean;
    taxId: string | null; pensionId: string | null; isActive: boolean; createdById: string; createdAt: Date;
    components: PayProfileComponent[];
}

export interface PayslipLineEntity {
    id: string; kind: LineKind; componentId: string | null; loanId: string | null; label: string; type: PayComponentType; amountKobo: bigint;
    expenseAccountId: string | null; liabilityAccountId: string | null; sortOrder: number;
}

export interface PayslipEntity {
    id: string; runId: string; staffId: string; payslipNumber: string | null; grossKobo: bigint; totalDeductionsKobo: bigint; netKobo: bigint;
    employerContributionKobo: bigint; status: PayslipStatus; paidAt: Date | null; paymentReference: string | null; snapshot: PayslipSnapshot | null;
    createdAt: Date; lines: PayslipLineEntity[];
}

export interface PayslipSnapshot {
    payslipNumber: string; school: { name: string | null; address: string | null; logoUrl: string | null };
    staff: { id: string; name: string; employeeId: string | null; designation: string | null; department: string | null };
    period: { year: number; month: number; label: string }; payDate: string;
    bank: { bankName: string | null; accountName: string | null; last4: string | null };
    lines: { label: string; type: PayComponentType; kind: LineKind; amountKobo: string }[];
    grossKobo: string; totalDeductionsKobo: string; netKobo: string; employerContributionKobo: string;
}

export interface PayrollRunEntity {
    id: string; runNumber: string; periodYear: number; periodMonth: number; payDate: Date; status: PayrollRunStatus;
    grossKobo: bigint; deductionsKobo: bigint; employerCostKobo: bigint; netKobo: bigint; staffCount: number; calculatedAt: Date | null;
    createdById: string; submittedAt: Date | null; approvedById: string | null; approvedAt: Date | null;
    rejectedById: string | null; rejectedAt: Date | null; rejectionReason: string | null;
    paidAt: Date | null; paidById: string | null; paidOn: Date | null; paidFromAccountId: string | null; paymentReference: string | null;
    accrualJournalId: string | null; paymentJournalId: string | null; cancelledAt: Date | null; cancelledById: string | null; cancelReason: string | null;
    notes: string | null; version: number; createdAt: Date; payslips: PayslipEntity[];
}

export interface LoanEntity {
    id: string; staffId: string; principalKobo: bigint; balanceKobo: bigint; monthlyRepaymentKobo: bigint; startYear: number; startMonth: number;
    status: LoanStatus; reason: string | null; approvedById: string; disbursedOn: Date; paidFromAccountId: string; disbursementJournalId: string;
    cancelledAt: Date | null; cancelReason: string | null; version: number; createdAt: Date; repaymentsCount: number;
}

export interface RemittanceEntity {
    id: string; liabilityAccountId: string; liabilityAccountName: string | null; periodYear: number; periodMonth: number; amountKobo: bigint; paidOn: Date;
    fromAccountId: string; reference: string | null; note: string | null; journalId: string; createdById: string;
    reversedAt: Date | null; reverseReason: string | null; createdAt: Date;
}
