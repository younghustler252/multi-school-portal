import { IRecurringRepository } from "../repositories/recurring.repository";
import { IExpenseRepository } from "../repositories/expense.repository";
import { IVendorRepository } from "../repositories/vendor.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { ExpenseApprovalService, resolveMoneyAccount } from "../services/expense-approval.service";
import { NumberSequenceService } from "../../../shared/services/number-sequence.service";
import { RecurringMapper, linesToJson } from "../mappers/budget.mapper";
import { ExpenseMapper } from "../mappers/expense.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { ActorType } from "../../audit/domain/audit.enums";
import { TenantContext } from "../../../infrastructure/database/prisma/tenant.context";
import { expenseErrors } from "../domain/expense.errors";
import { RecurringEntity } from "../domain/expense.entity";
import { MAX_CATCH_UP_RUNS, checkExpenseAccounts, expenseNumber, needsApproval, nextRunAfter } from "../domain/expense.policy";
import { dayString, parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { CreateRecurringDtoType, UpdateRecurringDtoType, ListRecurringQueryType } from "../dtos/recurring.dto";
import { ExpenseOptions, defaultTransaction, prepareExpense, loadExpense } from "./expense-shared";

interface Dependencies {
    recurringRepository: IRecurringRepository; expenseRepository: IExpenseRepository; vendorRepository: IVendorRepository;
    ledgerAccountRepository: ILedgerAccountRepository; expenseApprovalService: ExpenseApprovalService; numberSequenceService: NumberSequenceService;
    recurringMapper: RecurringMapper; expenseMapper: ExpenseMapper; auditService: AuditService;
}

async function load(repo: IRecurringRepository, id: string): Promise<RecurringEntity> {
    const r = await repo.findById(id);
    if (!r) throw expenseErrors.recurringNotFound();
    return r;
}

async function checkTemplate(d: Dependencies, t: { kind: string; vendorId?: string | null; payFromAccountId?: string | null; lines: { ledgerAccountId: string }[] }) {
    if (t.kind === "BILL" && !t.vendorId) throw expenseErrors.vendorRequired();
    if (t.vendorId) {
        const v = await d.vendorRepository.findById(t.vendorId);
        if (!v) throw expenseErrors.refNotFound("The vendor");
        if (!v.isActive) throw expenseErrors.vendorInactive(v.name);
    }
    checkExpenseAccounts(t.lines.map(l => l.ledgerAccountId), await d.ledgerAccountRepository.findByIds(t.lines.map(l => l.ledgerAccountId)));
    if (t.kind === "DIRECT") {
        if (!t.payFromAccountId) throw expenseErrors.payAccountRequired();
        await resolveMoneyAccount(d.ledgerAccountRepository, t.payFromAccountId);
    }
}

export class ListRecurringUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListRecurringQueryType) {
        const r = await this.d.recurringRepository.list(q.active, q.page, q.limit);
        return { data: r.data.map(x => this.d.recurringMapper.toResponse(x)), meta: r.meta };
    }
}

export class GetRecurringUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) { return this.d.recurringMapper.toResponse(await load(this.d.recurringRepository, id)); }
}

export class CreateRecurringUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: CreateRecurringDtoType) {
        parseDay(dto.startDate);
        if (dto.endDate) { parseDay(dto.endDate); if (dto.endDate < dto.startDate) throw expenseErrors.recurringInvalid("The end date cannot be before the start date"); }
        await checkTemplate(this.d, dto);
        const lines = dto.lines.map(l => ({ ledgerAccountId: l.ledgerAccountId, description: l.description ?? dto.description, amountKobo: l.amountKobo }));
        const created = await this.d.recurringRepository.create({
            vendorId: dto.vendorId ?? null, kind: dto.kind, payFromAccountId: dto.kind === "DIRECT" ? dto.payFromAccountId ?? null : null, description: dto.description,
            lines: linesToJson(lines), frequency: dto.frequency, startDate: parseDay(dto.startDate), endDate: dto.endDate ? parseDay(dto.endDate) : null,
            nextRunDate: parseDay(dto.startDate), autoApprove: dto.autoApprove, createdById: actorUserId,
        });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "recurring_expenses.created", entity: "RecurringExpense", entityId: created.id,
            newValue: { description: dto.description, frequency: dto.frequency, startDate: dto.startDate, autoApprove: dto.autoApprove },
        });
        return this.d.recurringMapper.toResponse(created);
    }
}

export class UpdateRecurringUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateRecurringDtoType) {
        const r = await load(this.d.recurringRepository, id);
        const lines = dto.lines?.map(l => ({ ledgerAccountId: l.ledgerAccountId, description: l.description ?? dto.description ?? r.description, amountKobo: l.amountKobo })) ?? r.lines;
        const merged = { kind: r.kind, vendorId: dto.vendorId ?? r.vendorId, payFromAccountId: dto.payFromAccountId ?? r.payFromAccountId, lines };
        await checkTemplate(this.d, merged);
        const endDate = dto.endDate === undefined ? r.endDate : dto.endDate === null ? null : parseDay(dto.endDate);
        if (endDate && endDate < r.startDate) throw expenseErrors.recurringInvalid("The end date cannot be before the start date");
        const frequency = dto.frequency ?? r.frequency;
        // A new frequency re-counts from the start day, so the next run is the first one after the last that ran (or the start itself)
        const nextRunDate = dto.frequency
            ? parseDay(nextRunAfter(dayString(r.startDate), frequency, r.lastRunAt ? dayString(new Date(Math.max(r.lastRunAt.getTime(), r.startDate.getTime()))) : null))
            : r.nextRunDate;

        const updated = await this.d.recurringRepository.update(id, {
            ...(dto.vendorId !== undefined && { vendorId: dto.vendorId }), ...(dto.payFromAccountId !== undefined && { payFromAccountId: dto.payFromAccountId }),
            ...(dto.description !== undefined && { description: dto.description }), ...(dto.lines && { lines: linesToJson(lines) }),
            frequency, endDate, nextRunDate, ...(dto.autoApprove !== undefined && { autoApprove: dto.autoApprove }),
        });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "recurring_expenses.updated", entity: "RecurringExpense", entityId: id,
            oldValue: { frequency: r.frequency, autoApprove: r.autoApprove }, newValue: { frequency, autoApprove: updated.autoApprove },
        });
        return this.d.recurringMapper.toResponse(updated);
    }
}

export class SetRecurringActiveUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, isActive: boolean) {
        const r = await load(this.d.recurringRepository, id);
        if (r.isActive === isActive) return this.d.recurringMapper.toResponse(r);
        const updated = await this.d.recurringRepository.update(id, { isActive });
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: isActive ? "recurring_expenses.resumed" : "recurring_expenses.paused", entity: "RecurringExpense", entityId: id });
        return this.d.recurringMapper.toResponse(updated);
    }
}

export class DeleteRecurringUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string) {
        const r = await load(this.d.recurringRepository, id);
        if (await this.d.recurringRepository.hasExpenses(id)) throw expenseErrors.recurringInvalid("It has already made expenses. Pause it instead of deleting it");
        await this.d.recurringRepository.delete(id);
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "recurring_expenses.deleted", entity: "RecurringExpense", entityId: id, oldValue: { description: r.description } });
        return { deleted: true };
    }
}

export interface RecurringRunSummary { checked: number; created: number; autoApproved: number; skipped: number; failed: { recurringId: string; code: string; message: string }[] }

/*
| THE DAILY RUN. For every active repeating expense whose next run day has come, make the expense dated that day (a draft that is submitted for approval,
| or approved at once when the template says autoApprove), then move the next run day on. A school that was away catches up, at most MAX_CATCH_UP_RUNS
| at a time. Safe to run twice: the database allows one expense per template per day. A template that fails is reported and the others carry on.
*/
export class RunRecurringExpensesUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: ExpenseOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(schoolId: string): Promise<RecurringRunSummary> {
        const d = this.d;
        const today = todayInFinanceZone(this.now());
        const due = await d.recurringRepository.findDue(today);
        const summary: RecurringRunSummary = { checked: due.length, created: 0, autoApproved: 0, skipped: 0, failed: [] };

        for (const r of due) {
            let next = dayString(r.nextRunDate);
            let made = 0;
            try {
                while (next <= today && (r.endDate === null || next <= dayString(r.endDate)) && made < MAX_CATCH_UP_RUNS) {
                    if (await d.expenseRepository.recurringExists(r.id, next)) summary.skipped++;
                    else {
                        const approved = await this.makeOne(schoolId, r, next);
                        summary.created++; if (approved) summary.autoApproved++;
                    }
                    made++;
                    next = nextRunAfter(dayString(r.startDate), r.frequency, next);
                }
            } catch (err) {
                const e = err as { code?: string; message?: string };
                summary.failed.push({ recurringId: r.id, code: e.code ?? "ERROR", message: e.message ?? String(err) });
            }
            // Move on even after a failure part-way: what was made stays made, and the failing day is tried again tomorrow
            await d.recurringRepository.update(r.id, { nextRunDate: parseDay(next), lastRunAt: this.now() });
        }
        return summary;
    }

    /* One expense from the template: all or nothing (so a failed approval leaves no half-made expense behind). Returns true when it was approved at once. */
    private async makeOne(schoolId: string, r: RecurringEntity, day: string): Promise<boolean> {
        const d = this.d;
        return this.transaction(async () => {
            const p = await prepareExpense(d, {
                kind: r.kind, vendorId: r.vendorId ?? undefined, description: r.description, expenseDate: day, payFromAccountId: r.payFromAccountId ?? undefined,
                lines: r.lines.map(l => ({ ledgerAccountId: l.ledgerAccountId, description: l.description, amountKobo: l.amountKobo })),
            }, this.now());
            const draft = await d.expenseRepository.createDraft({ ...p.data, requestedById: r.createdById, recurringExpenseId: r.id }, p.lines);

            const year = todayInFinanceZone(this.now()).slice(0, 4);
            const number = expenseNumber(year, await d.numberSequenceService.next("expense", year));
            const ok = await d.expenseRepository.transition(draft.id, ["DRAFT"], draft.version, {
                status: "PENDING_APPROVAL", expenseNumber: number, submittedAt: this.now(),
            });
            if (!ok) throw expenseErrors.expenseChanged();

            const autoApprove = r.autoApprove || !needsApproval(p.totalKobo);
            if (autoApprove) {
                await d.expenseApprovalService.approve(await loadExpense(d.expenseRepository, draft.id), { schoolId, actorUserId: r.createdById, auto: true });
            }
            return autoApprove;
        });
    }
}

export interface SchoolRef { id: string; name: string; schemaName: string }
export const RECURRING_ACTOR_ID = "SYSTEM_RECURRING_EXPENSES";

/* Every school with a database schema, each in its own tenant context. One school crashing never stops the others. */
export class RunRecurringForAllSchoolsUseCase {
    constructor(
        private readonly d: { runRecurringExpensesUseCase: RunRecurringExpensesUseCase; auditService: AuditService },
        private readonly listSchools: () => Promise<SchoolRef[]> = defaultSchools,
    ) {}

    async execute() {
        const schools = await this.listSchools();
        const out = { schools: schools.length, created: 0, failing: [] as { schoolId: string; name: string; failed: RecurringRunSummary["failed"] }[], crashed: [] as { schoolId: string; name: string; error: string }[] };
        for (const school of schools) {
            try {
                const s = await TenantContext.run({ tenantSchema: school.schemaName, schoolId: school.id }, () => this.d.runRecurringExpensesUseCase.execute(school.id));
                out.created += s.created;
                if (s.created > 0 || s.failed.length > 0) {
                    await this.d.auditService.log({
                        userId: RECURRING_ACTOR_ID, schoolId: school.id, actorType: ActorType.SYSTEM, action: "recurring_expenses.ran", entity: "RecurringExpense", entityId: school.id,
                        newValue: { created: s.created, autoApproved: s.autoApproved, failed: s.failed.length },
                    });
                }
                if (s.failed.length > 0) out.failing.push({ schoolId: school.id, name: school.name, failed: s.failed });
            } catch (err) {
                out.crashed.push({ schoolId: school.id, name: school.name, error: err instanceof Error ? err.message : String(err) });
            }
        }
        return out;
    }
}

async function defaultSchools(): Promise<SchoolRef[]> {
    const { prisma } = await import("../../../infrastructure/database/prisma/prisma.client");
    const rows = await prisma.school.findMany({ where: { schemaProvisionedAt: { not: null }, isActive: true }, select: { id: true, name: true, schemaName: true } });
    return rows.filter((s): s is SchoolRef => Boolean(s.schemaName));
}
