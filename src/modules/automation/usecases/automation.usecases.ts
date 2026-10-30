import type { IAutomationRuleRepository, IAutomationRunRepository, AutomationRuleRow } from "../repositories/automation.repository";
import { AutomationRunnerService, RunReport } from "../services/automation-runner.service";
import { AUTOMATION_DEFINITIONS, DEFINITION_BY_KEY, AutomationDefinition, defaultParams, resolveParams } from "../domain/automation-definitions";
import { DEFAULT_SCHEDULE, describeSchedule, nextRunAfter, readSchedule, validateSchedule } from "../domain/schedule";
import { automationErrors } from "../domain/automation.errors";
import { validateSettingValue } from "../../../foundation/settings.engine";
import { preferencesOf, PreferencesReader } from "../../../foundation/settings.registry";
import type { EntitlementsService } from "../../../foundation/entitlements.service";
import type { AuditService } from "../../audit/services/audit.service";
import type { ChannelPolicyService } from "../../notifications/services/channel-policy.service";
import type { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";
import type { UpdateAutomationDtoType } from "../dtos/automation.dto";
import { AUTOMATION_ACTOR_ID } from "../services/automation-runner.service";
import { ActorType } from "../../audit/domain/audit.enums";

interface Deps {
    automationRuleRepository: IAutomationRuleRepository; automationRunRepository: IAutomationRunRepository;
    automationRunnerService: AutomationRunnerService; entitlementsService: EntitlementsService; auditService: AuditService;
    channelPolicyService: ChannelPolicyService; notificationDispatchService: NotificationDispatchService;
    schoolPreferencesService?: PreferencesReader;
}
const PLAN_KEY = "automation.rules.max";

/* Every definition has one rule per school. It is created the first time anyone (or the tick) looks. A definition says whether it starts ON (only the fee reminder the school already had) or OFF. */
export async function ensureDefaultRules(d: Pick<Deps, "automationRuleRepository">, now: Date): Promise<AutomationRuleRow[]> {
    let rules = await d.automationRuleRepository.list();
    for (const def of AUTOMATION_DEFINITIONS) {
        if (rules.some(r => r.definitionKey === def.key)) continue;
        const enabled = def.defaultEnabled;
        await d.automationRuleRepository.create({
            definitionKey: def.key, name: def.name, enabled, params: defaultParams(def), channels: [...def.defaultChannels],
            schedule: def.defaultSchedule, nextRunAt: enabled ? nextRunAfter(def.defaultSchedule, now) : null, templateKey: def.templateKey, createdById: null,
        });
        rules = await d.automationRuleRepository.list();
    }
    return rules;
}

function present(rule: AutomationRuleRow, def: AutomationDefinition, last?: { status: string; triggeredAt: Date; matched: number; notified: number; skippedReason: string | null } | null) {
    const params = resolveParams(def, rule.params);
    const schedule = readSchedule(rule.schedule);
    return {
        id: rule.id, key: def.key, name: def.name, description: def.description, enabled: rule.enabled,
        channels: rule.channels, templateKey: def.templateKey, schedule, scheduleText: describeSchedule(schedule),
        params: def.params.map(p => ({ key: p.key, label: p.label, description: p.description, kind: p.kind, min: (p as any).min, max: (p as any).max, default: p.default, value: params[p.key] })),
        lastRunAt: rule.lastRunAt, nextRunAt: rule.enabled ? rule.nextRunAt : null,
        lastRun: last ? { status: last.status, at: last.triggeredAt, matched: last.matched, notified: last.notified, skippedReason: last.skippedReason } : null,
    };
}
const defOf = (rule: AutomationRuleRow) => DEFINITION_BY_KEY.get(rule.definitionKey);

export class ListAutomationsUseCase {
    constructor(private readonly d: Deps, private readonly now: () => Date = () => new Date()) {}
    async execute(schoolId: string) {
        const rules = await ensureDefaultRules(this.d, this.now());
        const last = await this.d.automationRunRepository.latestForRules(rules.map(r => r.id));
        const prefs = await preferencesOf(this.d);
        const channels = await this.d.channelPolicyService.evaluate(schoolId, ["IN_APP", "EMAIL", "SMS"]);
        return {
            schoolEnabled: prefs["automation.enabled"] === true, channels,
            automations: rules.filter(r => defOf(r)).map(r => present(r, defOf(r)!, last.get(r.id))),
        };
    }
}

export class GetAutomationUseCase {
    constructor(private readonly d: Deps) {}
    async execute(id: string) {
        const rule = await this.d.automationRuleRepository.findById(id);
        if (!rule || !defOf(rule)) throw automationErrors.ruleNotFound();
        const runs = await this.d.automationRunRepository.listForRule(id, 20);
        return { ...present(rule, defOf(rule)!, runs[0]), runs };
    }
}

export class UpdateAutomationUseCase {
    constructor(private readonly d: Deps, private readonly now: () => Date = () => new Date()) {}
    async execute(schoolId: string, userId: string, id: string, dto: UpdateAutomationDtoType) {
        const rule = await this.d.automationRuleRepository.findById(id);
        const def = rule && defOf(rule);
        if (!rule || !def) throw automationErrors.ruleNotFound();

        const changes: Parameters<IAutomationRuleRepository["update"]>[1] = { updatedById: userId };
        const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
        const note = (k: string, b: unknown, a: unknown) => { before[k] = b; after[k] = a; };

        if (dto.channels) {
            const channels = [...new Set(dto.channels)] as string[];
            if (JSON.stringify([...channels].sort()) !== JSON.stringify([...rule.channels].sort())) { changes.channels = channels; note("channels", rule.channels, channels); }
        }
        if (dto.params) {
            const merged = { ...resolveParams(def, rule.params) };
            for (const [k, v] of Object.entries(dto.params)) {
                const p = def.params.find(x => x.key === k);
                if (!p) throw automationErrors.invalid([`Unknown number: ${k}`]);
                const checked = validateSettingValue(p, v);
                if (!checked.ok) throw automationErrors.invalid([checked.message]);
                merged[k] = checked.value;
            }
            const was = resolveParams(def, rule.params);
            if (JSON.stringify(merged) !== JSON.stringify(was)) { changes.params = merged; note("params", was, merged); }
        }
        let schedule = readSchedule(rule.schedule);
        if (dto.schedule) {
            const problems = validateSchedule(dto.schedule);
            if (problems.length) throw automationErrors.invalid(problems);
            if (JSON.stringify(dto.schedule) !== JSON.stringify(schedule)) { changes.schedule = dto.schedule; note("schedule", schedule, dto.schedule); schedule = dto.schedule as typeof schedule; }
        }
        const turningOn = dto.enabled === true && !rule.enabled;
        if (dto.enabled !== undefined && dto.enabled !== rule.enabled) {
            if (turningOn) {
                const prefs = await preferencesOf(this.d);
                if (prefs["automation.enabled"] !== true) throw automationErrors.disabledForSchool();
                const limit = await this.d.entitlementsService.checkLimit(schoolId, PLAN_KEY, 1);
                if (!limit.allowed) throw automationErrors.planLimit((limit as { limit?: number }).limit);
            }
            changes.enabled = dto.enabled; note("enabled", rule.enabled, dto.enabled);
        }
        if (Object.keys(after).length === 0) return present(rule, def);

        const willRun = changes.enabled ?? rule.enabled;
        if (willRun && (turningOn || changes.schedule)) changes.nextRunAt = nextRunAfter(schedule, this.now());
        if (changes.enabled === false) changes.nextRunAt = null;

        const saved = await this.d.automationRuleRepository.update(id, changes);
        await this.d.auditService.log({ userId, schoolId, action: "automation.updated", entity: "AutomationRule", entityId: id, oldValue: before, newValue: after });
        return present(saved, def);
    }
}

export class DryRunAutomationUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string): Promise<RunReport> {
        const rule = await this.d.automationRuleRepository.findById(id);
        if (!rule || !defOf(rule)) throw automationErrors.ruleNotFound();
        return this.d.automationRunnerService.run(rule, { schoolId, trigger: "MANUAL", dryRun: true });
    }
}

export class RunAutomationNowUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, userId: string, id: string): Promise<RunReport> {
        const rule = await this.d.automationRuleRepository.findById(id);
        if (!rule || !defOf(rule)) throw automationErrors.ruleNotFound();
        if (!rule.enabled) throw automationErrors.ruleDisabled();
        const prefs = await preferencesOf(this.d);
        if (prefs["automation.enabled"] !== true) throw automationErrors.disabledForSchool();
        const report = await this.d.automationRunnerService.run(rule, { schoolId, trigger: "MANUAL", actorId: userId });
        if (report.status === "SKIPPED" && report.skippedReason === "no_channel_available") throw automationErrors.noChannel(report.blocked);
        await this.d.auditService.log({
            userId, schoolId, action: "automation.run", entity: "AutomationRule", entityId: id,
            newValue: { status: report.status, matched: report.matched, created: report.created },
        });
        return report;
    }
}

export class ListAutomationRunsUseCase {
    constructor(private readonly d: Deps) {}
    async execute(id: string, limit: number) {
        if (!(await this.d.automationRuleRepository.findById(id))) throw automationErrors.ruleNotFound();
        return this.d.automationRunRepository.listForRule(id, Math.min(Math.max(limit || 20, 1), 100));
    }
}

export interface TickSummary { due: number; ran: number; skipped: number; failed: number; requeued: number }

/* The tick for the school whose tenant context is open: create missing rules, hand any stuck messages back to the queue, then run
   every rule that is due. A rule is "claimed" first (its next time moves forward in one atomic update), so two workers never both run it,
   and a tick that was down for days runs a rule once, not once per missed day. */
export class RunDueAutomationsUseCase {
    constructor(private readonly d: Deps, private readonly now: () => Date = () => new Date()) {}
    async execute(schoolId: string): Promise<TickSummary> {
        const now = this.now();
        const s: TickSummary = { due: 0, ran: 0, skipped: 0, failed: 0, requeued: 0 };
        await ensureDefaultRules(this.d, now);
        try { s.requeued = await this.d.notificationDispatchService.requeueStale(); } catch (e) { console.error("automation: requeue failed:", e instanceof Error ? e.message : e); }

        for (const rule of await this.d.automationRuleRepository.findDue(now)) {
            if (!defOf(rule)) continue;
            s.due++;
            const next = nextRunAfter(readSchedule(rule.schedule), now);
            if (rule.nextRunAt === null) { await this.d.automationRuleRepository.claim(rule.id, null, next); continue; }   // first sight: schedule it, don't run
            if (!(await this.d.automationRuleRepository.claim(rule.id, rule.nextRunAt, next))) continue;
            const report = await this.d.automationRunnerService.run(rule, { schoolId, trigger: "SCHEDULE" });
            if (report.status === "FAILED") s.failed++; else if (report.status === "SKIPPED") s.skipped++; else s.ran++;
        }
        return s;
    }
}

export interface SchoolRef { id: string; name: string; schemaName: string }
export interface AllSchoolsSummary { schools: number; ran: number; skipped: number; failed: number; crashed: { schoolId: string; error: string }[] }

async function defaultSchools(): Promise<SchoolRef[]> {
    const { prisma } = await import("../../../infrastructure/database/prisma/prisma.client");
    const schools = await prisma.school.findMany({ where: { schemaProvisionedAt: { not: null }, isActive: true }, select: { id: true, name: true, schemaName: true } });
    return schools.filter((s): s is SchoolRef => !!s.schemaName);
}

export class RunAutomationsForAllSchoolsUseCase {
    constructor(
        private readonly d: { runDueAutomationsUseCase: RunDueAutomationsUseCase; auditService: AuditService },
        private readonly listSchools: () => Promise<SchoolRef[]> = defaultSchools,
        private readonly inSchool: <T>(school: SchoolRef, fn: () => Promise<T>) => Promise<T> = async (school, fn) => {
            const { TenantContext } = await import("../../../infrastructure/database/prisma/tenant.context");
            return TenantContext.run({ tenantSchema: school.schemaName, schoolId: school.id } as any, fn);
        },
    ) {}

    async execute(): Promise<AllSchoolsSummary> {
        const out: AllSchoolsSummary = { schools: 0, ran: 0, skipped: 0, failed: 0, crashed: [] };
        for (const school of await this.listSchools()) {
            out.schools++;
            try {
                const t = await this.inSchool(school, () => this.d.runDueAutomationsUseCase.execute(school.id));
                out.ran += t.ran; out.skipped += t.skipped; out.failed += t.failed;
            } catch (e) {
                const error = e instanceof Error ? e.message : String(e);
                out.crashed.push({ schoolId: school.id, error });
                await this.d.auditService.log({ userId: AUTOMATION_ACTOR_ID, schoolId: school.id, actorType: ActorType.SYSTEM, action: "automation.tick_failed", entity: "School", entityId: school.id, newValue: { error: error.slice(0, 500) } });
            }
        }
        return out;
    }
}
