import { z } from "zod";
import type { PrismaClient } from "../../../../generated/public";
import type { AuditService } from "../../../audit/services/audit.service";
import { provisioningErrors } from "../../domain/provisioning.errors";

/*
| SCHOOL PROVISIONING (platform realm): which schools have their database ready, which are waiting, running or have FAILED,
| and a way to try again. The truth about "ready" is School.schemaProvisionedAt; the queue only says what happened to a school that is not ready.
| Retrying is safe at any time: the worker never rebuilds a schema that exists, and it skips a school that is already provisioned.
*/
export type ProvisionState = "provisioned" | "queued" | "running" | "failed" | "stuck";
export interface QueueJobInfo { schoolId: string; state: "queued" | "running" | "failed"; failedReason?: string | null; attemptsMade: number; at: number | null }
export interface ProvisionQueuePort {
    jobs(): Promise<QueueJobInfo[]>;
    removeFailedFor(schoolId: string): Promise<void>;
    enqueue(data: { schoolId: string; subdomain: string; schoolName: string }): Promise<void>;
}

/** The real queue, loaded on first use so that importing this file never opens a Redis connection. */
export function bullProvisionQueue(): ProvisionQueuePort {
    const load = () => import("../../../../infrastructure/jobs/queues/provision-schema.queue");
    return {
        async jobs() {
            const { provisionSchemaQueue } = await load();
            const out: QueueJobInfo[] = [];
            for (const [bull, state] of [["failed", "failed"], ["active", "running"], ["waiting", "queued"], ["delayed", "queued"], ["prioritized", "queued"]] as const) {
                for (const j of await provisionSchemaQueue.getJobs([bull], 0, 999)) {
                    out.push({ schoolId: j.data.schoolId, state, failedReason: j.failedReason ?? null, attemptsMade: j.attemptsMade, at: j.finishedOn ?? j.processedOn ?? j.timestamp ?? null });
                }
            }
            return out;
        },
        async removeFailedFor(schoolId) {
            const { provisionSchemaQueue } = await load();
            for (const j of await provisionSchemaQueue.getJobs(["failed"], 0, 999)) if (j.data.schoolId === schoolId) await j.remove();
        },
        async enqueue(data) { await (await load()).addProvisionSchemaJob(data); },
    };
}

export const ProvisioningQuery = z.object({
    page:   z.coerce.number().int().min(1).default(1),
    limit:  z.coerce.number().int().min(1).max(100).default(20),
    state:  z.enum(["all", "provisioned", "pending", "failed"]).default("all"),
    search: z.string().trim().max(100).optional(),
});
export type ProvisioningQueryType = z.infer<typeof ProvisioningQuery>;

interface Deps { prismaClient: PrismaClient; provisionQueue: ProvisionQueuePort; auditService: AuditService }

const SELECT = { id: true, name: true, subdomain: true, schemaName: true, schemaProvisionedAt: true, createdAt: true, status: true } as const;
const trim = (s: string | null | undefined) => (s ? s.slice(0, 500) : null);

/* Queue facts for a school that is NOT provisioned. The most severe live job wins: running, then queued, then failed; none means "stuck" (nothing is working on it). */
function stateOf(jobs: QueueJobInfo[]): { state: ProvisionState; failedReason: string | null; attempts: number; lastAttemptAt: number | null } {
    const pick = (s: QueueJobInfo["state"]) => jobs.filter(j => j.state === s).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
    const j = pick("running") ?? pick("queued") ?? pick("failed");
    if (!j) return { state: "stuck", failedReason: null, attempts: 0, lastAttemptAt: null };
    return { state: j.state === "running" ? "running" : j.state === "queued" ? "queued" : "failed", failedReason: j.state === "failed" ? trim(j.failedReason) : null, attempts: j.attemptsMade, lastAttemptAt: j.at };
}

export class ListSchoolProvisioningUseCase {
    constructor(private readonly d: Deps) {}

    async execute(q: ProvisioningQueryType) {
        const search = q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { subdomain: { contains: q.search, mode: "insensitive" as const } }] } : {};
        const base = { deletedAt: null, ...search };
        const jobsBySchool = new Map<string, QueueJobInfo[]>();
        for (const j of await this.d.provisionQueue.jobs()) jobsBySchool.set(j.schoolId, [...(jobsBySchool.get(j.schoolId) ?? []), j]);

        const unprovisioned = (await this.d.prismaClient.school.findMany({ where: { ...base, schemaProvisionedAt: null }, select: SELECT, orderBy: { createdAt: "desc" } }))
            .map(s => ({ ...s, provisioned: false, ...stateOf(jobsBySchool.get(s.id) ?? []) }));
        const counts = {
            pending:     unprovisioned.length,
            failed:      unprovisioned.filter(s => s.state === "failed").length,
            running:     unprovisioned.filter(s => s.state === "running").length,
            queued:      unprovisioned.filter(s => s.state === "queued").length,
            stuck:       unprovisioned.filter(s => s.state === "stuck").length,
            provisioned: await this.d.prismaClient.school.count({ where: { ...base, schemaProvisionedAt: { not: null } } }),
        };

        const attention = q.state === "provisioned" ? [] : q.state === "failed" ? unprovisioned.filter(s => s.state === "failed") : unprovisioned;
        const wantsProvisioned = q.state === "all" || q.state === "provisioned";
        const total = attention.length + (wantsProvisioned ? counts.provisioned : 0);

        const offset = (q.page - 1) * q.limit;
        const items: any[] = attention.slice(offset, offset + q.limit);
        const room = q.limit - items.length;
        if (wantsProvisioned && room > 0) {
            const skip = Math.max(offset - attention.length, 0);
            const rows = await this.d.prismaClient.school.findMany({ where: { ...base, schemaProvisionedAt: { not: null } }, select: SELECT, orderBy: { createdAt: "desc" }, skip, take: room });
            items.push(...rows.map(s => ({ ...s, provisioned: true, state: "provisioned" as ProvisionState, failedReason: null, attempts: 0, lastAttemptAt: null })));
        }
        return { data: items, meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(Math.ceil(total / q.limit), 1) }, counts };
    }
}

export class RetrySchoolProvisioningUseCase {
    constructor(private readonly d: Deps) {}

    async execute(actorUserId: string, schoolId: string) {
        const school = await this.d.prismaClient.school.findFirst({ where: { id: schoolId, deletedAt: null }, select: SELECT });
        if (!school) throw provisioningErrors.notFound();
        if (school.schemaProvisionedAt) throw provisioningErrors.already();

        const current = stateOf((await this.d.provisionQueue.jobs()).filter(j => j.schoolId === schoolId));
        if (current.state === "running" || current.state === "queued") throw provisioningErrors.inProgress(current.state);

        await this.d.provisionQueue.removeFailedFor(schoolId);
        await this.d.provisionQueue.enqueue({ schoolId, subdomain: school.subdomain, schoolName: school.name });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "school.provisioning_retried", entity: "School", entityId: schoolId,
            oldValue: { state: current.state, failedReason: current.failedReason }, newValue: { state: "queued" },
        });
        return { schoolId, state: "queued" as ProvisionState };
    }
}
