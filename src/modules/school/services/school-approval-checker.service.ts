import { ISchoolRepository } from "../repositories/school.repository";
import { VerifySchoolUseCase } from "../usecases/platform/verify-school.usecase";
import { requiredDocsFor, SYSTEM_ACTOR_ID } from "../domain/school.policy";

interface Dependencies {
    schoolRepository:    ISchoolRepository;
    verifySchoolUseCase: VerifySchoolUseCase;
}

/*
| When every document required for the school's ownership type is approved, the school is
| verified automatically (by the system actor). Kept under its old method name.
*/
export class SchoolApprovalCheckerService {
    constructor(private readonly d: Dependencies) {}

    async checkAndApproveIfReady(schoolId: string, actorId: string = SYSTEM_ACTOR_ID): Promise<void> {
        const school = await this.d.schoolRepository.findById(schoolId);
        if (!school || school.verificationStatus === "verified") return;

        const docs = await this.d.schoolRepository.findDocumentsBySchoolId(schoolId);
        const ready = requiredDocsFor(school.schoolOwnership).every(type =>
            docs.some(d => d.type === type && d.status === "approved"),
        );
        if (ready) await this.d.verifySchoolUseCase.execute(schoolId, actorId, { override: false });
    }
}
