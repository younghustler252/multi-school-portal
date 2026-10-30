import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { AssignedComponent, LoanDue } from "../domain/payroll-calc";
import {
    LoanEntity, LoanStatus, PayComponentEntity, PayProfileEntity, PayrollRunEntity, PayrollRunStatus, PayslipEntity, PayslipSnapshot, RemittanceEntity,
} from "../domain/payroll.entity";

export interface IPayComponentRepository {
    findById(id: string): Promise<PayComponentEntity | null>;
    findByIds(ids: string[]): Promise<PayComponentEntity[]>;
    findByCode(code: string): Promise<PayComponentEntity | null>;
    list(f: { type?: string; status?: "active" | "inactive" | "all" }, page?: number, limit?: number): Promise<PaginatedResult<PayComponentEntity>>;
    create(data: Record<string, any>): Promise<PayComponentEntity>;
    update(id: string, data: Record<string, any>): Promise<PayComponentEntity>;
    remove(id: string): Promise<void>;                                      // soft delete
    inUse(id: string): Promise<boolean>;                                    // on a profile or a payslip line
}

export interface NewProfile {
    staffId: string; effectiveFrom: Date; basicSalaryKobo: bigint; bankCode: string | null; bankName: string | null; accountName: string | null;
    accountNumberEncrypted: string | null; accountNumberLast4: string | null; taxId: string | null; pensionId: string | null; createdById: string;
    components: { componentId: string; valueOverride: bigint | null }[];
}

/** One staff member as a run sees them on the last day of the month. */
export interface RunSubject { staffId: string; profileId: string; basicSalaryKobo: bigint; assigned: AssignedComponent[] }

export interface IPayProfileRepository {
    findById(id: string): Promise<PayProfileEntity | null>;
    /** The profile in force on a day, or null. */
    effectiveOn(staffId: string, day: Date): Promise<PayProfileEntity | null>;
    history(staffId: string): Promise<PayProfileEntity[]>;                  // newest first
    /** The profile that starts latest, to keep dated history in order. */
    latest(staffId: string): Promise<PayProfileEntity | null>;
    /** Ends every open profile of the staff member the day before `from`, then adds the new one. */
    createFrom(data: NewProfile): Promise<PayProfileEntity>;
    /** Everyone with a profile in force on the day, with the components that apply. Inactive components are left out. */
    subjectsFor(day: Date): Promise<RunSubject[]>;
    list(page?: number, limit?: number): Promise<PaginatedResult<PayProfileEntity>>;     // current profiles only
}

export interface NewPayslip {
    staffId: string; grossKobo: bigint; totalDeductionsKobo: bigint; netKobo: bigint; employerContributionKobo: bigint;
    lines: { kind: string; componentId: string | null; loanId: string | null; label: string; type: string; amountKobo: bigint; expenseAccountId: string | null; liabilityAccountId: string | null; sortOrder: number }[];
}

export interface PayslipFilters { runId?: string; staffId?: string; statuses?: string[] }

export interface IPayrollRunRepository {
    findById(id: string): Promise<PayrollRunEntity | null>;                 // with payslips and lines
    list(f: { status?: PayrollRunStatus; year?: number }, page?: number, limit?: number): Promise<PaginatedResult<PayrollRunEntity>>;
    existsForMonth(year: number, month: number): Promise<boolean>;          // any run not cancelled
    create(data: Record<string, any>): Promise<PayrollRunEntity>;
    /** Moves a run from one of these states, only at this version. False = someone else got there first. */
    transition(id: string, from: PayrollRunStatus[], version: number, data: Record<string, any>): Promise<boolean>;
    /** Replaces every draft payslip of the run with new ones (a recalculation). */
    replacePayslips(runId: string, payslips: NewPayslip[]): Promise<void>;
    findPayslip(id: string): Promise<PayslipEntity | null>;
    listPayslips(f: PayslipFilters, page?: number, limit?: number): Promise<PaginatedResult<PayslipEntity>>;
    finalizePayslip(id: string, payslipNumber: string, snapshot: PayslipSnapshot): Promise<void>;
    markPayslipsPaid(runId: string, at: Date, reference: string | null): Promise<void>;
    markPayslipsVoid(runId: string): Promise<void>;                         // the run was reversed
    /** Approved or paid and still standing: the runs behind the books' Salaries payable. */
    runsInYear(year: number): Promise<PayrollRunEntity[]>;
}

export interface ILoanRepository {
    findById(id: string): Promise<LoanEntity | null>;
    list(f: { staffId?: string; status?: LoanStatus }, page?: number, limit?: number): Promise<PaginatedResult<LoanEntity>>;
    create(data: Record<string, any>): Promise<LoanEntity>;
    /** What each of these staff members' active loans take in a month (the first month is on or before it). */
    dueFor(staffIds: string[], year: number, month: number): Promise<(LoanDue & { staffId: string; balanceKobo: bigint; monthlyKobo: bigint })[]>;
    /** Takes a repayment off the balance only if the loan is active and still owes at least that much. False = it changed. */
    applyRepayment(loanId: string, payslipId: string, amountKobo: bigint): Promise<boolean>;
    /** Puts back every repayment taken for these payslips (a run reversed). */
    reverseRepayments(payslipIds: string[], at: Date): Promise<void>;
    cancel(id: string, version: number, by: string, reason: string, at: Date): Promise<boolean>;
}

export interface IRemittanceRepository {
    findById(id: string): Promise<RemittanceEntity | null>;
    list(f: { year?: number; month?: number; accountId?: string }, page?: number, limit?: number): Promise<PaginatedResult<RemittanceEntity>>;
    create(data: Record<string, any>): Promise<RemittanceEntity>;
    markReversed(id: string, by: string, reason: string, at: Date): Promise<boolean>;
}

export interface StaffInfo { id: string; name: string; employeeId: string | null; designation: string | null; department: string | null; isActive: boolean }

export interface IPayrollContextRepository {
    staffInfo(ids: string[]): Promise<StaffInfo[]>;
    activeStaffIds(): Promise<string[]>;
}
