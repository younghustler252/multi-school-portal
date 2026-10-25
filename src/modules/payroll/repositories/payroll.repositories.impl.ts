import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { ComponentMapper, LoanMapper, ProfileMapper, RemittanceMapper, RunMapper, payslipOf } from "../mappers/payroll.mapper";
import {
    LoanEntity, LoanStatus, PayComponentEntity, PayProfileEntity, PayrollRunEntity, PayrollRunStatus, PayslipEntity, PayslipSnapshot, RemittanceEntity,
} from "../domain/payroll.entity";
import { parsePagination, buildPaginationMeta } from "../../../shared/utils/pagination";
import {
    ILoanRepository, IPayComponentRepository, IPayProfileRepository, IPayrollContextRepository, IPayrollRunRepository, IRemittanceRepository,
    NewPayslip, NewProfile, PayslipFilters, RunSubject, StaffInfo,
} from "./payroll.repositories";

const PROFILE_INCLUDE = { components: { include: { component: { select: { name: true, code: true } } } } };

export class PayComponentRepositoryImpl extends BaseTenantRepository<PayComponentEntity> implements IPayComponentRepository {
    protected readonly modelName = "payComponent";
    protected readonly softDelete = true;
    constructor({ componentMapper }: { componentMapper: ComponentMapper }) { super(componentMapper); }

    findByIds(ids: string[]) { return this.findMany({ id: { in: ids } }); }
    findByCode(code: string) { return this.findOne({ code }); }

    list(f: { type?: string; status?: "active" | "inactive" | "all" }, page?: number, limit?: number) {
        const where = { ...(f.type && { type: f.type }), ...(f.status === "inactive" ? { isActive: false } : f.status === "all" ? {} : { isActive: true }) };
        return this.paginate({ page, limit, where, orderBy: { name: "asc" } });
    }

    async remove(id: string): Promise<void> { await this.delete(id); }

    async inUse(id: string): Promise<boolean> {
        const [onProfiles, onSlips] = await Promise.all([
            this.prisma.staffPayComponent.count({ where: { componentId: id } }),
            this.prisma.payslipLine.count({ where: { componentId: id } }),
        ]);
        return onProfiles + onSlips > 0;
    }
}

export class PayProfileRepositoryImpl extends BaseTenantRepository<PayProfileEntity> implements IPayProfileRepository {
    protected readonly modelName = "staffPayProfile";
    private readonly componentMapper = new ComponentMapper();
    constructor({ profileMapper }: { profileMapper: ProfileMapper }) { super(profileMapper); }

    findById(id: string) { return super.findById(id, PROFILE_INCLUDE); }

    effectiveOn(staffId: string, day: Date) {
        return this.findOne({ staffId, isActive: true, effectiveFrom: { lte: day }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }] }, PROFILE_INCLUDE);
    }

    history(staffId: string) { return this.findMany({ staffId }, PROFILE_INCLUDE, { effectiveFrom: "desc" }); }

    async latest(staffId: string) {
        const rows = await this.model().findMany({ where: { staffId }, orderBy: { effectiveFrom: "desc" }, take: 1, include: PROFILE_INCLUDE });
        return this.mapOne(rows[0] ?? null);
    }

    async createFrom(d: NewProfile): Promise<PayProfileEntity> {
        const dayBefore = new Date(d.effectiveFrom.getTime() - 86_400_000);
        await this.model().updateMany({ where: { staffId: d.staffId, effectiveTo: null }, data: { effectiveTo: dayBefore } });
        const { components, ...rest } = d;
        return super.create({ ...rest, components: { create: components.map(c => ({ componentId: c.componentId, valueOverride: c.valueOverride })) } }, PROFILE_INCLUDE);
    }

    async subjectsFor(day: Date): Promise<RunSubject[]> {
        const rows = await this.model().findMany({
            where: { isActive: true, effectiveFrom: { lte: day }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }] },
            include: { components: { where: { isActive: true }, include: { component: true } } },
        });
        return rows.map((r: any) => ({
            staffId: r.staffId, profileId: r.id, basicSalaryKobo: r.basicSalaryKobo,
            assigned: r.components.filter((c: any) => c.component.isActive && !c.component.deletedAt)
                .map((c: any) => ({ component: this.componentMapper.toDomain(c.component), valueOverride: c.valueOverride })),
        }));
    }

    list(page?: number, limit?: number) {
        return this.paginate({ page, limit, where: { isActive: true, effectiveTo: null }, include: PROFILE_INCLUDE, orderBy: { effectiveFrom: "desc" } });
    }
}

const RUN_FULL = { payslips: { include: { lines: true } } };

export class PayrollRunRepositoryImpl extends BaseTenantRepository<PayrollRunEntity> implements IPayrollRunRepository {
    protected readonly modelName = "payrollRun";
    constructor({ runMapper }: { runMapper: RunMapper }) { super(runMapper); }

    findById(id: string) { return super.findById(id, RUN_FULL); }

    list(f: { status?: PayrollRunStatus; year?: number }, page?: number, limit?: number) {
        return this.paginate({ page, limit, where: { ...(f.status && { status: f.status }), ...(f.year && { periodYear: f.year }) }, orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { createdAt: "desc" }] as any });
    }

    async existsForMonth(year: number, month: number) { return (await this.model().count({ where: { periodYear: year, periodMonth: month, status: { not: "CANCELLED" } } })) > 0; }

    create(data: Record<string, any>) { return super.create(data, RUN_FULL); }

    async transition(id: string, from: PayrollRunStatus[], version: number, data: Record<string, any>): Promise<boolean> {
        const r = await this.model().updateMany({ where: { id, version, status: { in: from } }, data: { ...data, version: { increment: 1 } } });
        return r.count === 1;
    }

    async replacePayslips(runId: string, payslips: NewPayslip[]): Promise<void> {
        await this.prisma.payslip.deleteMany({ where: { runId } });
        for (const p of payslips) {
            const { lines, ...rest } = p;
            await this.prisma.payslip.create({ data: { ...rest, runId, lines: { create: lines as any } } as any });
        }
    }

    async findPayslip(id: string): Promise<PayslipEntity | null> {
        const raw = await this.prisma.payslip.findUnique({ where: { id }, include: { lines: true } });
        return raw ? payslipOf(raw) : null;
    }

    async listPayslips(f: PayslipFilters, page?: number, limit?: number) {
        const where = { ...(f.runId && { runId: f.runId }), ...(f.staffId && { staffId: f.staffId }), ...(f.statuses && { status: { in: f.statuses } }) };
        const { skip, page: p, limit: l } = parsePagination({ page, limit });
        const [rows, total] = await Promise.all([
            this.prisma.payslip.findMany({ where: where as any, include: { lines: true }, orderBy: { createdAt: "desc" }, skip, take: l }),
            this.prisma.payslip.count({ where: where as any }),
        ]);
        return { data: rows.map(payslipOf), meta: buildPaginationMeta(total, p, l) };
    }

    async finalizePayslip(id: string, payslipNumber: string, snapshot: PayslipSnapshot): Promise<void> {
        await this.prisma.payslip.update({ where: { id }, data: { payslipNumber, snapshot: snapshot as any, status: "FINAL" } });
    }

    async markPayslipsPaid(runId: string, at: Date, reference: string | null): Promise<void> {
        await this.prisma.payslip.updateMany({ where: { runId }, data: { status: "PAID", paidAt: at, paymentReference: reference } });
    }

    async markPayslipsVoid(runId: string): Promise<void> {
        await this.prisma.payslip.updateMany({ where: { runId }, data: { status: "VOID" } });
    }

    async runsInYear(year: number) {
        return this.findMany({ periodYear: year }, undefined, { periodMonth: "asc" });
    }
}

export class LoanRepositoryImpl extends BaseTenantRepository<LoanEntity> implements ILoanRepository {
    protected readonly modelName = "staffLoan";
    constructor({ loanMapper }: { loanMapper: LoanMapper }) { super(loanMapper); }
    private static readonly COUNT = { _count: { select: { repayments: { where: { reversedAt: null } } } } };

    findById(id: string) { return super.findById(id, LoanRepositoryImpl.COUNT); }

    list(f: { staffId?: string; status?: LoanStatus }, page?: number, limit?: number) {
        return this.paginate({ page, limit, where: { ...(f.staffId && { staffId: f.staffId }), ...(f.status && { status: f.status }) }, include: LoanRepositoryImpl.COUNT, orderBy: { createdAt: "desc" } });
    }

    create(data: Record<string, any>) { return super.create(data, LoanRepositoryImpl.COUNT); }

    async dueFor(staffIds: string[], year: number, month: number) {
        const rows = await this.model().findMany({ where: { staffId: { in: staffIds }, status: "ACTIVE", balanceKobo: { gt: 0 } }, orderBy: { createdAt: "asc" } });
        const key = year * 12 + month;
        return rows.filter((l: any) => l.startYear * 12 + l.startMonth <= key).map((l: any) => ({
            loanId: l.id, staffId: l.staffId, label: `Loan repayment${l.reason ? `: ${l.reason}` : ""}`, balanceKobo: l.balanceKobo, monthlyKobo: l.monthlyRepaymentKobo,
            amountKobo: l.monthlyRepaymentKobo < l.balanceKobo ? l.monthlyRepaymentKobo : l.balanceKobo,
        }));
    }

    async applyRepayment(loanId: string, payslipId: string, amountKobo: bigint): Promise<boolean> {
        const r = await this.model().updateMany({ where: { id: loanId, status: "ACTIVE", balanceKobo: { gte: amountKobo } }, data: { balanceKobo: { decrement: amountKobo }, version: { increment: 1 } } });
        if (r.count !== 1) return false;
        await this.prisma.staffLoanRepayment.create({ data: { loanId, payslipId, amountKobo } });
        await this.model().updateMany({ where: { id: loanId, balanceKobo: 0n }, data: { status: "CLEARED" } });
        return true;
    }

    async reverseRepayments(payslipIds: string[], at: Date): Promise<void> {
        const reps = await this.prisma.staffLoanRepayment.findMany({ where: { payslipId: { in: payslipIds }, reversedAt: null } });
        for (const r of reps) {
            await this.prisma.staffLoanRepayment.update({ where: { id: r.id }, data: { reversedAt: at } });
            await this.model().updateMany({ where: { id: r.loanId }, data: { balanceKobo: { increment: r.amountKobo }, status: "ACTIVE", version: { increment: 1 } } });
        }
    }

    async cancel(id: string, version: number, by: string, reason: string, at: Date): Promise<boolean> {
        const r = await this.model().updateMany({ where: { id, version, status: "ACTIVE" }, data: { status: "CANCELLED", cancelledAt: at, cancelledById: by, cancelReason: reason, version: { increment: 1 } } });
        return r.count === 1;
    }
}

export class RemittanceRepositoryImpl extends BaseTenantRepository<RemittanceEntity> implements IRemittanceRepository {
    protected readonly modelName = "payrollRemittance";
    constructor({ remittanceMapper }: { remittanceMapper: RemittanceMapper }) { super(remittanceMapper); }

    list(f: { year?: number; month?: number; accountId?: string }, page?: number, limit?: number) {
        return this.paginate({
            page, limit, orderBy: { paidOn: "desc" },
            where: { ...(f.year && { periodYear: f.year }), ...(f.month && { periodMonth: f.month }), ...(f.accountId && { liabilityAccountId: f.accountId }) },
        });
    }

    async markReversed(id: string, by: string, reason: string, at: Date): Promise<boolean> {
        const r = await this.model().updateMany({ where: { id, reversedAt: null }, data: { reversedAt: at, reversedById: by, reverseReason: reason } });
        return r.count === 1;
    }
}

/* Staff facts the payroll needs. Finance only reads the Staff table. */
export class PayrollContextRepositoryImpl implements IPayrollContextRepository {
    private get db() { return getTenantClient(); }

    async staffInfo(ids: string[]): Promise<StaffInfo[]> {
        if (ids.length === 0) return [];
        const rows = await this.db.staff.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, middleName: true, employeeId: true, designation: true, department: true, isActive: true, deletedAt: true } });
        return rows.map(s => ({
            id: s.id, name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "), employeeId: s.employeeId, designation: s.designation, department: s.department,
            isActive: s.isActive && !s.deletedAt,
        }));
    }

    async activeStaffIds(): Promise<string[]> {
        return (await this.db.staff.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true } })).map(s => s.id);
    }
}
