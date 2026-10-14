import { ISchoolRepository } from "../../repositories/school.repository";
import { SchoolMapper, PlatformSchoolResponseData } from "../../mappers/school.mapper";
import { NotificationService } from "../../../notifications/services/notification.service";
import { AuditService } from "../../../audit/services/audit.service";
import { schoolErrors } from "../../domain/school.errors";
import { SUSPENSION_VERIFICATION_EXPIRED } from "../../domain/school.policy";

interface Dependencies {
    schoolRepository: ISchoolRepository; schoolMapper: SchoolMapper;
    notificationService: NotificationService; auditService: AuditService;
}

export class SuspendSchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorId: string, reason: string): Promise<PlatformSchoolResponseData> {
        const d = this.d;
        const row = await d.schoolRepository.findPlatformRow(schoolId);
        if (!row) throw schoolErrors.notFound();
        if (row.school.status === "suspended") return d.schoolMapper.toPlatformResponse(row.school, row.plan, row.mrrKobo);

        const updated = await d.schoolRepository.update(schoolId, {
            status: "suspended", isActive: false, suspendedAt: new Date(), suspensionReason: reason,
        });
        await d.auditService.log({
            userId: actorId, schoolId, action: "school.suspended", entity: "School", entityId: schoolId,
            oldValue: { status: row.school.status }, newValue: { status: "suspended" }, metadata: { reason },
        });
        await d.notificationService.sendPlatformNotification({
            schoolId, type: "account_suspended", createdByAdminId: actorId, title: "Your school has been suspended", message: reason,
        });
        return d.schoolMapper.toPlatformResponse(updated, row.plan, row.mrrKobo);
    }
}

export class ReactivateSchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    // A school suspended for not verifying in time gets a fresh trial window
    async execute(schoolId: string, actorId: string): Promise<PlatformSchoolResponseData> {
        const d = this.d;
        const row = await d.schoolRepository.findPlatformRow(schoolId);
        if (!row) throw schoolErrors.notFound();
        if (row.school.status !== "suspended") throw schoolErrors.notSuspended();

        const expired = row.school.suspensionReason === SUSPENSION_VERIFICATION_EXPIRED;
        const updated = await d.schoolRepository.update(schoolId, {
            status: "active", isActive: true, suspendedAt: null, suspensionReason: null,
            ...(expired ? { activatedAt: new Date() } : {}),
        });
        await d.auditService.log({
            userId: actorId, schoolId, action: "school.reactivated", entity: "School", entityId: schoolId,
            oldValue: { status: "suspended" }, newValue: { status: "active" }, metadata: { trialRestarted: expired },
        });
        await d.notificationService.sendPlatformNotification({
            schoolId, type: "account_verified", createdByAdminId: actorId,
            title: "Your school is active again", message: `${updated.name} has been reactivated.`,
        });
        return d.schoolMapper.toPlatformResponse(updated, row.plan, row.mrrKobo);
    }
}
