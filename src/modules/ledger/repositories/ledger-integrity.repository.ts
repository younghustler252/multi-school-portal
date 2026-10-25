import { IntegrityFinding, SystemAccountRow } from "../domain/ledger-integrity";

/* Read-only queries that look for broken rules. Each returns the findings it made (empty when the rule holds). */
export interface ILedgerIntegrityRepository {
    unbalancedJournals(): Promise<IntegrityFinding[]>;
    trialBalance(): Promise<IntegrityFinding[]>;
    reversalProblems(): Promise<IntegrityFinding[]>;
    periodProblems(timeZone: string): Promise<IntegrityFinding[]>;       // period mismatch, future-dated, posted after close
    duplicateOpeningBalances(): Promise<IntegrityFinding[]>;
    linesOnDeletedAccounts(): Promise<IntegrityFinding[]>;
    expensesControls(): Promise<IntegrityFinding[]>;                       // payable = open bills (also per supplier); expense paid = its live payments
    feesControls(): Promise<IntegrityFinding[]>;                          // receivable = open invoices, advance = unallocated payments, invoices and credit = allocations
    payrollControls(): Promise<IntegrityFinding[]>;                       // salaries payable = unpaid approved payslips, staff loans receivable = active loans (also per person)
    systemAccounts(): Promise<SystemAccountRow[]>;
}
