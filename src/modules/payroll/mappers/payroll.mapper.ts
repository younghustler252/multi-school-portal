import { IMapper } from "../../../infrastructure/repository/base.repository";
import { koboOut, dayOut } from "../../ledger/mappers/kobo";
import {
    Band, LoanEntity, LoanStatus, PayComponentEntity, PayComponentType, PayCalcType, PayProfileEntity, PayrollRunEntity, PayrollRunStatus,
    PayslipEntity, PayslipLineEntity, PayslipStatus, RemittanceEntity, LineKind,
} from "../domain/payroll.entity";

/* Rows as the database returns them (only the columns the mappers read). */
type Row = Record<string, any>;

/* Bands are stored as JSON, where kobo is a digit string (JSON has no BigInt). */
export const bandsToJson = (bands: Band[] | null) => (bands ? bands.map(b => ({ upToKobo: b.upToKobo === null ? null : b.upToKobo.toString(), rateBp: b.rateBp })) : null);
const bandsFromJson = (v: unknown): Band[] | null =>
    Array.isArray(v) ? v.map((b: any) => ({ upToKobo: b.upToKobo === null || b.upToKobo === undefined ? null : BigInt(b.upToKobo), rateBp: Number(b.rateBp) })) : null;

export class ComponentMapper implements IMapper<Row, PayComponentEntity> {
    toDomain(r: Row): PayComponentEntity {
        return {
            id: r.id, name: r.name, code: r.code, type: r.type as PayComponentType, calcType: r.calcType as PayCalcType, defaultValue: r.defaultValue,
            bands: bandsFromJson(r.bands), isTaxable: r.isTaxable, isStatutory: r.isStatutory, expenseAccountId: r.expenseAccountId,
            liabilityAccountId: r.liabilityAccountId, isActive: r.isActive, createdAt: r.createdAt,
        };
    }
    toResponse(c: PayComponentEntity) {
        return {
            id: c.id, name: c.name, code: c.code, type: c.type, calcType: c.calcType,
            // kobo for FIXED, basis points for the percent types
            defaultValue: koboOut(c.defaultValue),
            bands: c.bands ? c.bands.map(b => ({ upToKobo: b.upToKobo === null ? null : koboOut(b.upToKobo), rateBp: b.rateBp })) : null,
            isTaxable: c.isTaxable, isStatutory: c.isStatutory, expenseAccountId: c.expenseAccountId, liabilityAccountId: c.liabilityAccountId, isActive: c.isActive,
        };
    }
}

export class ProfileMapper implements IMapper<Row, PayProfileEntity> {
    toDomain(r: Row): PayProfileEntity {
        return {
            id: r.id, staffId: r.staffId, effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo, basicSalaryKobo: r.basicSalaryKobo, payFrequency: r.payFrequency,
            bankCode: r.bankCode, bankName: r.bankName, accountName: r.accountName, accountNumberLast4: r.accountNumberLast4, hasAccountNumber: !!r.accountNumberEncrypted,
            taxId: r.taxId, pensionId: r.pensionId, isActive: r.isActive, createdById: r.createdById, createdAt: r.createdAt,
            components: (r.components ?? []).map((c: Row) => ({
                id: c.id, componentId: c.componentId, componentName: c.component?.name ?? "", componentCode: c.component?.code ?? "", valueOverride: c.valueOverride, isActive: c.isActive,
            })),
        };
    }
    /* The full account number is never returned; only the last four digits. Tax and pension numbers are shown to those who may see profiles at all. */
    toResponse(p: PayProfileEntity) {
        return {
            id: p.id, staffId: p.staffId, effectiveFrom: dayOut(p.effectiveFrom), effectiveTo: p.effectiveTo ? dayOut(p.effectiveTo) : null,
            basicSalaryKobo: koboOut(p.basicSalaryKobo), payFrequency: p.payFrequency,
            bank: { bankCode: p.bankCode, bankName: p.bankName, accountName: p.accountName, accountNumberLast4: p.accountNumberLast4, hasAccountNumber: p.hasAccountNumber },
            taxId: p.taxId, pensionId: p.pensionId, isActive: p.isActive, createdAt: p.createdAt,
            components: p.components.map(c => ({ id: c.id, componentId: c.componentId, name: c.componentName, code: c.componentCode, valueOverride: c.valueOverride === null ? null : koboOut(c.valueOverride), isActive: c.isActive })),
        };
    }
}

const lineOf = (l: Row): PayslipLineEntity => ({
    id: l.id, kind: l.kind as LineKind, componentId: l.componentId, loanId: l.loanId, label: l.label, type: l.type as PayComponentType, amountKobo: l.amountKobo,
    expenseAccountId: l.expenseAccountId, liabilityAccountId: l.liabilityAccountId, sortOrder: l.sortOrder,
});
export const payslipOf = (p: Row): PayslipEntity => ({
    id: p.id, runId: p.runId, staffId: p.staffId, payslipNumber: p.payslipNumber, grossKobo: p.grossKobo, totalDeductionsKobo: p.totalDeductionsKobo, netKobo: p.netKobo,
    employerContributionKobo: p.employerContributionKobo, status: p.status as PayslipStatus, paidAt: p.paidAt, paymentReference: p.paymentReference,
    snapshot: p.snapshot ?? null, createdAt: p.createdAt, lines: [...(p.lines ?? [])].sort((a: Row, b: Row) => a.sortOrder - b.sortOrder).map(lineOf),
});

export class RunMapper implements IMapper<Row, PayrollRunEntity> {
    toDomain(r: Row): PayrollRunEntity {
        return {
            id: r.id, runNumber: r.runNumber, periodYear: r.periodYear, periodMonth: r.periodMonth, payDate: r.payDate, status: r.status as PayrollRunStatus,
            grossKobo: r.grossKobo, deductionsKobo: r.deductionsKobo, employerCostKobo: r.employerCostKobo, netKobo: r.netKobo, staffCount: r.staffCount,
            calculatedAt: r.calculatedAt, createdById: r.createdById, submittedAt: r.submittedAt, approvedById: r.approvedById, approvedAt: r.approvedAt,
            rejectedById: r.rejectedById, rejectedAt: r.rejectedAt, rejectionReason: r.rejectionReason, paidAt: r.paidAt, paidById: r.paidById, paidOn: r.paidOn,
            paidFromAccountId: r.paidFromAccountId, paymentReference: r.paymentReference, accrualJournalId: r.accrualJournalId, paymentJournalId: r.paymentJournalId,
            cancelledAt: r.cancelledAt, cancelledById: r.cancelledById, cancelReason: r.cancelReason, notes: r.notes, version: r.version, createdAt: r.createdAt,
            payslips: (r.payslips ?? []).map(payslipOf),
        };
    }

    toSummary(r: PayrollRunEntity) {
        return {
            id: r.id, runNumber: r.runNumber, period: { year: r.periodYear, month: r.periodMonth }, payDate: dayOut(r.payDate), status: r.status,
            grossKobo: koboOut(r.grossKobo), deductionsKobo: koboOut(r.deductionsKobo), employerCostKobo: koboOut(r.employerCostKobo), netKobo: koboOut(r.netKobo),
            staffCount: r.staffCount, createdById: r.createdById, createdAt: r.createdAt,
        };
    }

    toResponse(r: PayrollRunEntity, names: Map<string, string> = new Map()) {
        return {
            ...this.toSummary(r),
            calculatedAt: r.calculatedAt, submittedAt: r.submittedAt, approvedById: r.approvedById, approvedAt: r.approvedAt,
            rejectedById: r.rejectedById, rejectedAt: r.rejectedAt, rejectionReason: r.rejectionReason,
            paidAt: r.paidAt, paidById: r.paidById, paidOn: r.paidOn ? dayOut(r.paidOn) : null, paidFromAccountId: r.paidFromAccountId, paymentReference: r.paymentReference,
            accrualJournalId: r.accrualJournalId, paymentJournalId: r.paymentJournalId, cancelledAt: r.cancelledAt, cancelReason: r.cancelReason, notes: r.notes, version: r.version,
            payslips: r.payslips.map(p => this.payslipSummary(p, names)),
        };
    }

    payslipSummary(p: PayslipEntity, names: Map<string, string> = new Map()) {
        return {
            id: p.id, runId: p.runId, staff: { id: p.staffId, name: p.snapshot ? p.snapshot.staff.name : (names.get(p.staffId) ?? null) }, payslipNumber: p.payslipNumber, status: p.status,
            grossKobo: koboOut(p.grossKobo), totalDeductionsKobo: koboOut(p.totalDeductionsKobo), netKobo: koboOut(p.netKobo), employerContributionKobo: koboOut(p.employerContributionKobo),
        };
    }

    /* One payslip with its lines. Once approved the lines come from the frozen snapshot, so what the person sees never moves. */
    payslipResponse(p: PayslipEntity, names: Map<string, string> = new Map()) {
        const lines = p.snapshot
            ? p.snapshot.lines.map(l => ({ label: l.label, type: l.type, kind: l.kind, amountKobo: koboOut(BigInt(l.amountKobo)) }))
            : p.lines.map(l => ({ label: l.label, type: l.type, kind: l.kind, amountKobo: koboOut(l.amountKobo) }));
        return { ...this.payslipSummary(p, names), paidAt: p.paidAt, paymentReference: p.paymentReference, lines, frozen: p.snapshot !== null };
    }
}

export class LoanMapper implements IMapper<Row, LoanEntity> {
    toDomain(r: Row): LoanEntity {
        return {
            id: r.id, staffId: r.staffId, principalKobo: r.principalKobo, balanceKobo: r.balanceKobo, monthlyRepaymentKobo: r.monthlyRepaymentKobo,
            startYear: r.startYear, startMonth: r.startMonth, status: r.status as LoanStatus, reason: r.reason, approvedById: r.approvedById, disbursedOn: r.disbursedOn,
            paidFromAccountId: r.paidFromAccountId, disbursementJournalId: r.disbursementJournalId, cancelledAt: r.cancelledAt, cancelReason: r.cancelReason,
            version: r.version, createdAt: r.createdAt, repaymentsCount: r._count?.repayments ?? 0,
        };
    }
    toResponse(l: LoanEntity, names: Map<string, string> = new Map()) {
        return {
            id: l.id, staff: { id: l.staffId, name: names.get(l.staffId) ?? null }, principalKobo: koboOut(l.principalKobo), balanceKobo: koboOut(l.balanceKobo),
            monthlyRepaymentKobo: koboOut(l.monthlyRepaymentKobo), startYear: l.startYear, startMonth: l.startMonth, status: l.status, reason: l.reason,
            approvedById: l.approvedById, disbursedOn: dayOut(l.disbursedOn), paidFromAccountId: l.paidFromAccountId, disbursementJournalId: l.disbursementJournalId,
            cancelledAt: l.cancelledAt, cancelReason: l.cancelReason, repayments: l.repaymentsCount, version: l.version, createdAt: l.createdAt,
        };
    }
}

export class RemittanceMapper implements IMapper<Row, RemittanceEntity> {
    toDomain(r: Row): RemittanceEntity {
        return {
            id: r.id, liabilityAccountId: r.liabilityAccountId, liabilityAccountName: null, periodYear: r.periodYear, periodMonth: r.periodMonth, amountKobo: r.amountKobo,
            paidOn: r.paidOn, fromAccountId: r.fromAccountId, reference: r.reference, note: r.note, journalId: r.journalId, createdById: r.createdById,
            reversedAt: r.reversedAt, reverseReason: r.reverseReason, createdAt: r.createdAt,
        };
    }
    toResponse(m: RemittanceEntity, accountNames: Map<string, string> = new Map()) {
        return {
            id: m.id, liabilityAccount: { id: m.liabilityAccountId, name: accountNames.get(m.liabilityAccountId) ?? null }, period: { year: m.periodYear, month: m.periodMonth },
            amountKobo: koboOut(m.amountKobo), paidOn: dayOut(m.paidOn), fromAccountId: m.fromAccountId, reference: m.reference, note: m.note, journalId: m.journalId,
            reversed: m.reversedAt !== null, reversedAt: m.reversedAt, reverseReason: m.reverseReason, createdAt: m.createdAt,
        };
    }
}
