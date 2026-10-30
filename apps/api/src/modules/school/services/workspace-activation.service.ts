import { ISchoolRepository } from "../repositories/school.repository";
import { UrlService } from "../../../shared/services/url.service";
import { AuditService } from "../../audit/services/audit.service";
import { addProvisionSchemaJob } from "../../../infrastructure/jobs/queues/provision-schema.queue";
import { schoolState } from "../domain/school.policy";

export interface WorkspaceInfo {
    schoolId:  string;
    subdomain: string;
    url:       string;
    state:     "setting_up";
}

interface Dependencies {
    schoolRepository: ISchoolRepository;
    urlService:       UrlService;
    auditService:     AuditService;
}

/*
|--------------------------------------------------------------------------
| WORKSPACE ACTIVATION
| Called when a registrant confirms their email. The school becomes "active"
| immediately (so the admin can sign in as soon as it is built), the build is queued,
| and verificationStatus stays "unverified" (risky features stay locked until verification).
| Idempotent: only a school still in "pending" is touched. If queueing fails, the lifecycle
| job notices an active school that never finished building and queues it again.
|--------------------------------------------------------------------------
*/
export class WorkspaceActivationService {
    constructor(private readonly d: Dependencies) {}

    async activateForRegistrant(userId: string): Promise<WorkspaceInfo | null> {
        const [school] = await this.d.schoolRepository.findPendingByUserId(userId);
        if (!school) return null;

        const updated = await this.d.schoolRepository.update(school.id, {
            status: "active", isActive: true, activatedAt: new Date(),
        });

        await this.d.auditService.log({
            userId, schoolId: school.id, action: "school.workspace_activated", entity: "School", entityId: school.id,
            oldValue: { status: school.status }, newValue: { status: updated.status, state: schoolState(updated) },
        });

        await addProvisionSchemaJob({ schoolId: school.id, subdomain: school.subdomain, schoolName: school.name });

        return {
            schoolId: school.id, subdomain: school.subdomain,
            url: this.d.urlService.schoolUrl(updated), state: "setting_up",
        };
    }
}
