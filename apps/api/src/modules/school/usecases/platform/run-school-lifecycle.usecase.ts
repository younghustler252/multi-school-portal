import { PrismaClient } from "../../../../generated/public";
import { ISchoolRepository } from "../../repositories/school.repository";
import { NotificationService } from "../../../notifications/services/notification.service";
import { AuditService } from "../../../audit/services/audit.service";
import { addProvisionSchemaJob } from "../../../../infrastructure/jobs/queues/provision-schema.queue";
import { getTenantClient } from "../../../../infrastructure/database/prisma/prisma.client";
import { TenantContext } from "../../../../infrastructure/database/prisma/tenant.context";
import {
    DEFAULT_UNCONFIRMED_REGISTRATION_HOURS, DEFAULT_UNVERIFIED_TRIAL_DAYS, DEFAULT_UNVERIFIED_RETENTION_DAYS,
    TRIAL_REMINDER_DAYS, PROVISIONING_STUCK_MINUTES, SUSPENSION_VERIFICATION_EXPIRED, SYSTEM_ACTOR_ID,
} from "../../domain/school.policy";

interface Dependencies {
    prismaClient: PrismaClient; schoolRepository: ISchoolRepository;
    notificationService: NotificationService; auditService: AuditService;
}

export interface LifecycleSummary {
    releasedUnconfirmed: number; reprovisioned: number; reminded: number; suspended: number;
    released: number; heldForReview: number;
}

const DAY = 86_400_000;
const SCHEMA_NAME = /^[a-z][a-z0-9_]*$/;

/*
|--------------------------------------------------------------------------
| SCHOOL LIFECYCLE (runs daily as the system; also safe to run any time)
| Protects subdomains from people who "just came to play", without hurting real schools:
|  1. REGISTRATIONS NEVER CONFIRMED  (pending for longer than the platform setting, default 72 h):
|     the school is released (subdomain and email freed) and the unconfirmed login is removed.
|  2. STUCK BUILDS: a school that is active but never finished being built is queued again.
|  3. UNVERIFIED TRIAL (default 30 days from activation): reminders at 7 and 1 days left, then the school
|     is suspended with reason "verification_expired" (locked, nothing deleted). Platform staff can
|     reactivate it, which restarts the trial.
|  4. RETENTION (default 60 more days): a school still suspended for that reason AND holding no data
|     (no students, no extra staff, no payments) is released: schema dropped, subdomain and email freed.
|     A school that has data is NEVER deleted automatically: it is left for a person to review.
| The three windows are PlatformSettings values; the constants in school.policy.ts are fallbacks.
|--------------------------------------------------------------------------
*/
export class RunSchoolLifecycleUseCase {
    constructor(private readonly d: Dependencies) {}

    private async settings() {
        const s = await this.d.prismaClient.platformSettings.findFirst() as unknown as
            { unconfirmedRegistrationHours?: number; unverifiedSchoolTrialDays?: number; unverifiedSchoolRetentionDays?: number } | null;
        return {
            unconfirmedHours: s?.unconfirmedRegistrationHours   ?? DEFAULT_UNCONFIRMED_REGISTRATION_HOURS,
            trialDays:        s?.unverifiedSchoolTrialDays      ?? DEFAULT_UNVERIFIED_TRIAL_DAYS,
            retentionDays:    s?.unverifiedSchoolRetentionDays  ?? DEFAULT_UNVERIFIED_RETENTION_DAYS,
        };
    }

    // Soft-delete: keeps foreign keys and the audit trail, frees the unique subdomain and email
    private async release(schoolId: string, reason: string, dropSchema: string | null): Promise<void> {
        const d = this.d;
        if (dropSchema) {
            if (!SCHEMA_NAME.test(dropSchema)) throw new Error(`Refusing to drop invalid schema name ${dropSchema}`);
            await d.prismaClient.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${dropSchema}" CASCADE`);
        }
        const tag = schoolId.slice(0, 8);
        const links = await d.prismaClient.userSchool.findMany({ where: { schoolId }, select: { userId: true } });

        await d.prismaClient.school.update({
            where: { id: schoolId },
            data: {
                deletedAt: new Date(), status: "deactivated", isActive: false, schemaName: null,
                subdomain: `released-${tag}`, email: `released-${tag}@released.invalid`, customDomain: null, customDomainVerifiedAt: null,
            },
        });
        // Remove logins that never confirmed their email and belong to no other school
        for (const { userId } of links) {
            const others = await d.prismaClient.userSchool.count({ where: { userId, schoolId: { not: schoolId } } });
            if (others === 0) await d.prismaClient.user.deleteMany({ where: { id: userId, isEmailVerified: false } });
        }
        await d.auditService.log({ userId: SYSTEM_ACTOR_ID, schoolId, action: "school.released", entity: "School", entityId: schoolId, metadata: { reason } });
    }

    private async hasData(schemaName: string, schoolId: string): Promise<boolean> {
        return TenantContext.run({ tenantSchema: schemaName, schoolId }, async () => {
            const db = getTenantClient();
            const [students, staff, payments] = await Promise.all([db.student.count(), db.staff.count(), db.payment.count()]);
            return students > 0 || staff > 1 || payments > 0;     // staff > 1: more than just the founding admin
        });
    }

    async execute(): Promise<LifecycleSummary> {
        const d = this.d;
        const cfg = await this.settings();
        const now = Date.now();
        const out: LifecycleSummary = { releasedUnconfirmed: 0, reprovisioned: 0, reminded: 0, suspended: 0, released: 0, heldForReview: 0 };

        // 1. Registrations never confirmed
        const unconfirmed = await d.schoolRepository.findMany({
            status: "pending", deletedAt: null, createdAt: { lt: new Date(now - cfg.unconfirmedHours * 3_600_000) },
        });
        for (const s of unconfirmed) { await this.release(s.id, "registration_never_confirmed", null); out.releasedUnconfirmed++; }

        // 2. Active but never finished building
        const stuck = await d.schoolRepository.findMany({
            status: "active", deletedAt: null, schemaProvisionedAt: null, activatedAt: { lt: new Date(now - PROVISIONING_STUCK_MINUTES * 60_000) },
        });
        for (const s of stuck) {
            await addProvisionSchemaJob({ schoolId: s.id, subdomain: s.subdomain, schoolName: s.name });
            out.reprovisioned++;
        }

        // 3. Unverified trial: reminders, then suspension
        const trialing = await d.schoolRepository.findMany({
            status: "active", deletedAt: null, activatedAt: { not: null }, verificationStatus: { in: ["unverified", "under_review", "rejected"] },
        });
        for (const s of trialing) {
            const left = cfg.trialDays - Math.floor((now - s.activatedAt!.getTime()) / DAY);
            if ((TRIAL_REMINDER_DAYS as readonly number[]).includes(left)) {
                await d.notificationService.sendPlatformNotification({
                    schoolId: s.id, type: "system_alert", createdByAdminId: SYSTEM_ACTOR_ID,
                    title: "Verify your school to keep it active",
                    message: `${s.name} will be locked in ${left} day${left === 1 ? "" : "s"} unless its documents are verified. Upload them from your setup checklist.`,
                });
                out.reminded++;
            } else if (left <= 0) {
                await d.schoolRepository.update(s.id, {
                    status: "suspended", isActive: false, suspendedAt: new Date(), suspensionReason: SUSPENSION_VERIFICATION_EXPIRED,
                });
                await d.notificationService.sendPlatformNotification({
                    schoolId: s.id, type: "account_suspended", createdByAdminId: SYSTEM_ACTOR_ID,
                    title: "Your school has been locked",
                    message: `${s.name} was not verified in time. Contact support to restore it. Nothing has been deleted.`,
                });
                await d.auditService.log({ userId: SYSTEM_ACTOR_ID, schoolId: s.id, action: "school.suspended", entity: "School", entityId: s.id, metadata: { reason: SUSPENSION_VERIFICATION_EXPIRED } });
                out.suspended++;
            }
        }

        // 4. Retention: release empty, long-expired schools
        const expired = await d.schoolRepository.findMany({
            status: "suspended", deletedAt: null, suspensionReason: SUSPENSION_VERIFICATION_EXPIRED,
            verificationStatus: { not: "verified" }, suspendedAt: { lt: new Date(now - cfg.retentionDays * DAY) },
        });
        for (const s of expired) {
            const built = !!s.schemaProvisionedAt && !!s.schemaName;
            let keep = false;
            if (built) { try { keep = await this.hasData(s.schemaName!, s.id); } catch { keep = true; } }  // if unsure, keep
            if (keep) { out.heldForReview++; continue; }
            await this.release(s.id, "verification_expired_no_data", built ? s.schemaName : null);
            out.released++;
        }
        return out;
    }
}
