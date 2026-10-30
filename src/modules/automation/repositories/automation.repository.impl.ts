import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import type { InvoiceRow } from "../domain/automation-definitions";
import { dayString, parseDay } from "../../ledger/domain/ledger.dates";
import type {
    IAutomationRuleRepository, IAutomationRunRepository, IAutomationSourceRepository,
    AutomationRuleRow, NewRule, RuleChanges, NewRunLog, RunLogRow,
} from "./automation.repository";

const db = () => getTenantClient();
const live = { deletedAt: null } as const;

export class AutomationRuleRepositoryImpl implements IAutomationRuleRepository {
    async list() { return (await db().automationRule.findMany({ where: live, orderBy: { createdAt: "asc" } })) as AutomationRuleRow[]; }
    async findById(id: string) { return (await db().automationRule.findFirst({ where: { id, ...live } })) as AutomationRuleRow | null; }
    async create(d: NewRule) {
        return (await db().automationRule.create({ data: {
            definitionKey: d.definitionKey, name: d.name, enabled: d.enabled, params: d.params as any, channels: d.channels as any,
            schedule: d.schedule as any, nextRunAt: d.nextRunAt, templateKey: d.templateKey, createdById: d.createdById, updatedById: d.createdById,
        } })) as AutomationRuleRow;
    }
    async update(id: string, c: RuleChanges) {
        return (await db().automationRule.update({ where: { id }, data: c as any })) as AutomationRuleRow;
    }
    countEnabled() { return db().automationRule.count({ where: { enabled: true, ...live } }); }
    async findDue(now: Date) {
        return (await db().automationRule.findMany({
            where: { enabled: true, ...live, OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] }, orderBy: { nextRunAt: "asc" },
        })) as AutomationRuleRow[];
    }
    async claim(id: string, expected: Date | null, next: Date) {
        const r = await db().automationRule.updateMany({ where: { id, enabled: true, ...live, nextRunAt: expected }, data: { nextRunAt: next } });
        return r.count === 1;
    }
}

export class AutomationRunRepositoryImpl implements IAutomationRunRepository {
    async create(l: NewRunLog) {
        return (await db().automationRunLog.create({ data: {
            ruleId: l.ruleId, trigger: l.trigger, status: l.status, matched: l.matched, notified: l.notified,
            skippedReason: l.skippedReason ?? null, error: l.error ? l.error.slice(0, 1000) : null,
        } })) as RunLogRow;
    }
    async listForRule(ruleId: string, limit: number) {
        return (await db().automationRunLog.findMany({ where: { ruleId }, orderBy: { triggeredAt: "desc" }, take: limit })) as RunLogRow[];
    }
    async latestForRules(ruleIds: string[]) {
        const out = new Map<string, RunLogRow>();
        for (const id of ruleIds) {
            const row = await db().automationRunLog.findFirst({ where: { ruleId: id }, orderBy: { triggeredAt: "desc" } });
            if (row) out.set(id, row as RunLogRow);
        }
        return out;
    }
}

export class AutomationSourceRepositoryImpl implements IAutomationSourceRepository {
    async findUnpaidInvoicesDueBetween(from: string, to: string, limit = 20000): Promise<InvoiceRow[]> {
        const rows = await db().feeInvoice.findMany({
            where: { status: { in: ["unpaid", "partial"] }, voidedAt: null, balanceKobo: { gt: 0n }, dueDate: { gte: parseDay(from), lte: parseDay(to) } },
            select: {
                id: true, invoiceNumber: true, dueDate: true, balanceKobo: true,
                student: { select: { id: true, firstName: true, lastName: true, guardianLinks: { select: { guardian: {
                    select: { id: true, firstName: true, email: true, phone: true, userId: true, isActive: true } } } } } },
            },
            orderBy: { dueDate: "asc" }, take: limit,
        });
        return rows.map(r => ({
            invoiceId: r.id, invoiceNumber: r.invoiceNumber, studentId: r.student.id,
            studentName: `${r.student.firstName} ${r.student.lastName}`.trim(),
            dueDate: dayString(r.dueDate as Date), balanceKobo: r.balanceKobo,
            guardians: r.student.guardianLinks.map(l => l.guardian).filter(g => g.isActive)
                .map(g => ({ id: g.id, firstName: g.firstName, email: g.email || null, phone: g.phone, userId: g.userId })),
        }));
    }
}
