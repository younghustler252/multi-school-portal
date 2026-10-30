import type { IAutomationRuleRepository, IAutomationRunRepository, IAutomationSourceRepository, AutomationRuleRow, RunStatus } from "../repositories/automation.repository";
import { AutomationChannel, DEFINITION_BY_KEY, resolveParams } from "../domain/automation-definitions";
import { formatDay, formatNaira } from "../domain/automation-format";
import { readSchedule, nextRunAfter } from "../domain/schedule";
import { renderPlain } from "../../message-templates/domain/template-engine";
import type { MessageTemplateService } from "../../message-templates/services/message-template.service";
import type { NotificationDispatchService, OutgoingMessage } from "../../notifications/services/notification-dispatch.service";
import type { ChannelPolicyService, ChannelBlock } from "../../notifications/services/channel-policy.service";
import { PreferencesReader, preferencesOf } from "../../../foundation/settings.registry";
import { todayInFinanceZone } from "../../ledger/domain/ledger.dates";

export interface RunOptions { schoolId: string; trigger: "SCHEDULE" | "MANUAL"; dryRun?: boolean; actorId?: string | null }
export interface RunReport {
    status: RunStatus; matched: number; people: number; messages: number; created: number; duplicates: number;
    blocked: ChannelBlock[]; skippedReason: string | null; error: string | null; dryRun: boolean;
    sample: { channel: AutomationChannel; to: string; title: string; message: string }[];
}

interface Deps {
    automationRuleRepository: IAutomationRuleRepository; automationRunRepository: IAutomationRunRepository;
    automationSourceRepository: IAutomationSourceRepository; messageTemplateService: MessageTemplateService;
    notificationDispatchService: NotificationDispatchService; channelPolicyService: ChannelPolicyService;
    schoolPreferencesService?: PreferencesReader;
    /** The name of the school whose tenant context is open. */
    schoolName: () => Promise<string>;
}

export const AUTOMATION_ACTOR_ID = "SYSTEM_AUTOMATION";
const CHUNK = 500;

/*
| AUTOMATION RUNNER: runs ONE rule for the open school. It never throws for a rule's own problems (a bad rule must not stop the
| others): it returns a report and writes a run log. A real run only sends messages; each message carries an idempotency key
| (rule, occasion, guardian, channel), so running twice, a retry or a "run now" next to the schedule never sends twice.
| A dry run does everything except sending and logging.
*/
export class AutomationRunnerService {
    constructor(private readonly d: Deps, private readonly now: () => Date = () => new Date()) {}

    async run(rule: AutomationRuleRow, o: RunOptions): Promise<RunReport> {
        const report: RunReport = { status: "SUCCESS", matched: 0, people: 0, messages: 0, created: 0, duplicates: 0, blocked: [], skippedReason: null, error: null, dryRun: !!o.dryRun, sample: [] };
        try {
            await this.execute(rule, o, report);
        } catch (e) {
            report.status = "FAILED"; report.error = e instanceof Error ? e.message : String(e);
        }
        if (!o.dryRun) await this.finish(rule, o, report);
        return report;
    }

    private async execute(rule: AutomationRuleRow, o: RunOptions, r: RunReport): Promise<void> {
        const def = DEFINITION_BY_KEY.get(rule.definitionKey);
        if (!def) { r.status = "FAILED"; r.error = `Unknown automation ${rule.definitionKey}`; return; }

        const prefs = await preferencesOf(this.d);
        if (prefs["automation.enabled"] !== true) { r.status = "SKIPPED"; r.skippedReason = "school_setting_off"; return; }

        const policy = await this.d.channelPolicyService.evaluate(o.schoolId, rule.channels);
        r.blocked = policy.blocked;
        if (policy.allowed.length === 0) { r.status = "SKIPPED"; r.skippedReason = "no_channel_available"; return; }

        const today = todayInFinanceZone(this.now());
        const params = resolveParams(def, rule.params);
        const { from, to } = def.window(params, today);
        const rows = await this.d.automationSourceRepository.findUnpaidInvoicesDueBetween(from, to);
        const occurrences = def.select(rows, params, today);
        r.matched = occurrences.length;
        if (occurrences.length === 0) return;

        const school = await this.d.schoolName();
        const texts = new Map<AutomationChannel, Awaited<ReturnType<MessageTemplateService["effective"]>>>();
        for (const c of policy.allowed) texts.set(c, await this.d.messageTemplateService.effective(def.templateKey, c));

        const people = new Set<string>();
        const messages: OutgoingMessage[] = [];
        let broken = 0;
        for (const { row, key } of occurrences) {
            for (const g of row.guardians) {
                for (const channel of policy.allowed) {
                    if (channel === "EMAIL" && !g.email) continue;
                    if (channel === "SMS" && !g.phone) continue;
                    const plain = renderPlain(texts.get(channel)!, {
                        guardian_name: g.firstName, student_name: row.studentName, school_name: school,
                        amount_due: formatNaira(row.balanceKobo), due_date: formatDay(row.dueDate), invoice_number: row.invoiceNumber ?? "",
                    });
                    if (plain.missing.length || !plain.body) { broken++; continue; }
                    people.add(g.id);
                    messages.push({
                        type: "fee_reminder", channel, title: plain.subject || def.name, message: plain.body,
                        recipient: { recipientType: "GUARDIAN", recipientEntityId: g.id, userId: g.userId },
                        idempotencyKey: `auto:${rule.id}:${key}:${g.id}:${channel}`,
                    });
                }
            }
        }
        r.people = people.size; r.messages = messages.length;
        if (broken) { r.status = "PARTIAL"; r.error = `${broken} message(s) could not be written (a placeholder has no value)`; }

        if (o.dryRun) {
            r.sample = messages.slice(0, 5).map(m => ({ channel: m.channel as AutomationChannel, to: m.recipient.recipientEntityId, title: m.title, message: m.message }));
            return;
        }
        for (let i = 0; i < messages.length; i += CHUNK) {
            const res = await this.d.notificationDispatchService.dispatch({
                sentById: o.actorId ?? rule.createdById ?? AUTOMATION_ACTOR_ID, targetType: "GUARDIAN", messages: messages.slice(i, i + CHUNK),
                metadata: { source: "automation", ruleId: rule.id, definitionKey: rule.definitionKey, trigger: o.trigger, delivery: { skipGreeting: true, bodyOnly: true } },
            });
            r.created += res.created; r.duplicates += res.duplicates;
        }
    }

    private async finish(rule: AutomationRuleRow, o: RunOptions, r: RunReport): Promise<void> {
        const now = this.now();
        try {
            await this.d.automationRunRepository.create({
                ruleId: rule.id, trigger: o.trigger, status: r.status, matched: r.matched, notified: r.created,
                skippedReason: r.skippedReason, error: r.error,
            });
            await this.d.automationRuleRepository.update(rule.id, { lastRunAt: now });
        } catch (e) {
            console.error("automation: could not write the run log:", e instanceof Error ? e.message : e);
        }
    }

    /** The next scheduled time for a rule, from now. */
    nextRun(rule: AutomationRuleRow): Date { return nextRunAfter(readSchedule(rule.schedule), this.now()); }
}
