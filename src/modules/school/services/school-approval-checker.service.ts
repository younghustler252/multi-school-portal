// modules/school/services/school-approval-checker.service.ts
import { ISchoolRepository } from "../repositories/school.repository";
import { ApproveSchoolUseCase } from "../usecases/super-admin/approve-school.usecase";

const REQUIRED_TYPES_BY_OWNERSHIP: Record<string, string[]> = {
    private:       ["proprietor_id", "cac_certificate"],
    international: ["proprietor_id", "cac_certificate"],
    mission:       ["proprietor_id", "cac_certificate"],
    public:        ["proprietor_id", "ministry_approval"],
};

const SYSTEM_ACTOR_ID = "SYSTEM_AUTO_VERIFICATION";

interface Dependencies {
    schoolRepository:     ISchoolRepository;
    approveSchoolUseCase: ApproveSchoolUseCase;
}

export class SchoolApprovalCheckerService {
    private readonly schoolRepository:     ISchoolRepository;
    private readonly approveSchoolUseCase: ApproveSchoolUseCase;

    constructor({ schoolRepository, approveSchoolUseCase }: Dependencies) {
        this.schoolRepository     = schoolRepository;
        this.approveSchoolUseCase = approveSchoolUseCase;
    }

    async checkAndApproveIfReady(schoolId: string, actorId: string = SYSTEM_ACTOR_ID): Promise<void> {
        const school = await this.schoolRepository.findById(schoolId);
        if (!school || school.status === "active") return;

        const required = REQUIRED_TYPES_BY_OWNERSHIP[school.schoolOwnership] ?? ["proprietor_id"];
        const allDocs = await this.schoolRepository.findDocumentsBySchoolId(schoolId);

        const allRequiredApproved = required.every(type =>
            allDocs.some(d => d.type === type && d.status === "approved"),
        );

        if (allRequiredApproved) {
            await this.approveSchoolUseCase.execute(schoolId, actorId);
        }
    }
}