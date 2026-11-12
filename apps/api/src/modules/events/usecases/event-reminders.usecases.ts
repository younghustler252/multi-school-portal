import { AUTOMATION_ACTOR_ID } from "../../automation/services/automation-runner.service";
import { ISchoolRepository } from "../../school/repositories/school.repository";
import { IEventRepository } from "../repositories/event.repository";
import { MAX_REMINDER_ATTEMPTS, STALE_PROCESSING_MINUTES } from "../domain/event.reminders";
import { hasStarted } from "../domain/event.notice";
import { EventNoticeService } from "../services/event-notice.service";

/*
| SENDING DUE REMINDERS for ONE school (the worker calls this every 5 minutes for each school).
|  - a reminder whose event is no longer published, or whose schedule moved on (older revision), is CANCELLED;
|  - with event notices off, or the event already started, it is SKIPPED, and a skipped reminder never fires later;
|  - otherwise it is sent once per person and channel (idempotency keys), then marked SENT;
|  - a failure puts it back for the next tick, up to 3 tries, then FAILED with the reason.
| A worker that died mid-way leaves rows PROCESSING; after 30 minutes they are put back.
*/
export interface ReminderRunSummary { claimed: number; sent: number; skipped: number; cancelled: number; failed: number; retried: number; recovered: number }
interface Deps { eventRepository: IEventRepository; schoolRepository: Pick<ISchoolRepository, "findById">; eventNoticeService: EventNoticeService }
export const REMINDER_BATCH = 200;
const FALLBACK_ACTOR = AUTOMATION_ACTOR_ID;      // the same system actor automation messages use

export class RunDueEventRemindersUseCase {
    constructor(private readonly d: Deps, private readonly now: () => Date = () => new Date()) {}

    async execute(schoolId: string): Promise<ReminderRunSummary> {
        const out: ReminderRunSummary = { claimed: 0, sent: 0, skipped: 0, cancelled: 0, failed: 0, retried: 0, recovered: 0 };
        const now = this.now(), repo = this.d.eventRepository;
        out.recovered = await repo.recoverStaleReminders(new Date(now.getTime() - STALE_PROCESSING_MINUTES * 60_000));
        const due = await repo.claimDueReminders(now, REMINDER_BATCH);
        out.claimed = due.length;
        if (due.length === 0) return out;
        const tz = (await this.d.schoolRepository.findById(schoolId))?.timezone || "UTC";

        for (const r of due) {
            try {
                const event = await repo.findById(r.eventId);
                if (!event || event.status !== "PUBLISHED" || event.revision !== r.revision) { await repo.finishReminder(r.id, "CANCELLED", "event is no longer published at this revision"); out.cancelled++; continue; }
                if (hasStarted(event, now, tz)) { await repo.finishReminder(r.id, "SKIPPED", "event had already started"); out.skipped++; continue; }
                const actor = event.publishedById ?? event.createdById ?? FALLBACK_ACTOR;
                const res = await this.d.eventNoticeService.sendReminder(schoolId, event, r.offsetMinutes, actor);
                if (res.sent) { await repo.finishReminder(r.id, "SENT"); out.sent++; }
                else { await repo.finishReminder(r.id, "SKIPPED", res.reason); out.skipped++; }
            } catch (e) {
                const why = (e instanceof Error ? e.message : String(e)).slice(0, 500);
                if (r.attempts >= MAX_REMINDER_ATTEMPTS) { await repo.finishReminder(r.id, "FAILED", why); out.failed++; }
                else { await repo.finishReminder(r.id, "PENDING", why); out.retried++; }
            }
        }
        return out;
    }
}

export interface SchoolRef { id: string; name: string; schemaName: string }
export interface AllSchoolsReminderSummary { schools: number; claimed: number; sent: number; skipped: number; failed: number; crashed: { schoolId: string; error: string }[] }

/** The worker's entry point: every active, provisioned school in its own tenant context. One school failing never stops the others. */
export class RunEventRemindersForAllSchoolsUseCase {
    constructor(
        private readonly d: { runDueEventRemindersUseCase: RunDueEventRemindersUseCase; schoolRepository?: ISchoolRepository },
        private readonly listSchools: () => Promise<SchoolRef[]> = async () =>
            (await this.d.schoolRepository!.findMany({ isActive: true, schemaProvisionedAt: { not: null } }))
                .filter(s => !!s.schemaName).map(s => ({ id: s.id, name: s.name, schemaName: s.schemaName! })),
        private readonly inSchool: <T>(school: SchoolRef, fn: () => Promise<T>) => Promise<T> = async (school, fn) => {
            const { TenantContext } = await import("../../../infrastructure/database/prisma/tenant.context");
            return TenantContext.run({ tenantSchema: school.schemaName, schoolId: school.id } as any, fn);
        },
    ) {}

    async execute(): Promise<AllSchoolsReminderSummary> {
        const out: AllSchoolsReminderSummary = { schools: 0, claimed: 0, sent: 0, skipped: 0, failed: 0, crashed: [] };
        for (const school of await this.listSchools()) {
            out.schools++;
            try {
                const r = await this.inSchool(school, () => this.d.runDueEventRemindersUseCase.execute(school.id));
                out.claimed += r.claimed; out.sent += r.sent; out.skipped += r.skipped; out.failed += r.failed;
            } catch (e) {
                out.crashed.push({ schoolId: school.id, error: (e instanceof Error ? e.message : String(e)).slice(0, 500) });
            }
        }
        return out;
    }
}
