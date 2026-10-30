import type { AutomationSources } from "../domain/automation-definitions";

export interface AutomationRuleRow {
    id: string; definitionKey: string; name: string; enabled: boolean;
    params: unknown; channels: ("IN_APP" | "EMAIL" | "SMS")[]; schedule: unknown;
    lastRunAt: Date | null; nextRunAt: Date | null; createdById: string | null; updatedById: string | null;
    createdAt: Date; updatedAt: Date;
}
export interface NewRule {
    definitionKey: string; name: string; enabled: boolean; params: Record<string, unknown>;
    channels: string[]; schedule: unknown; nextRunAt: Date | null; templateKey: string; createdById: string | null;
}
export interface RuleChanges {
    enabled?: boolean; params?: Record<string, unknown>; channels?: string[]; schedule?: unknown;
    nextRunAt?: Date | null; lastRunAt?: Date; updatedById?: string | null;
}
export type RunStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
export interface RunLogRow {
    id: string; ruleId: string; triggeredAt: Date; trigger: string; status: RunStatus;
    matched: number; notified: number; skippedReason: string | null; error: string | null;
}
export interface NewRunLog { ruleId: string; trigger: string; status: RunStatus; matched: number; notified: number; skippedReason?: string | null; error?: string | null }

export interface IAutomationRuleRepository {
    list(): Promise<AutomationRuleRow[]>;
    findById(id: string): Promise<AutomationRuleRow | null>;
    create(data: NewRule): Promise<AutomationRuleRow>;
    update(id: string, changes: RuleChanges): Promise<AutomationRuleRow>;
    countEnabled(): Promise<number>;
    /** Enabled rules whose time has come (nextRunAt in the past), plus enabled rules with no time yet. */
    findDue(now: Date): Promise<AutomationRuleRow[]>;
    /** Moves nextRunAt forward only if nobody else has: true means THIS caller owns the run. */
    claim(id: string, expectedNextRunAt: Date | null, newNextRunAt: Date): Promise<boolean>;
}
export interface IAutomationRunRepository {
    create(log: NewRunLog): Promise<RunLogRow>;
    listForRule(ruleId: string, limit: number): Promise<RunLogRow[]>;
    latestForRules(ruleIds: string[]): Promise<Map<string, RunLogRow>>;
}
export interface IAutomationSourceRepository extends AutomationSources {}
