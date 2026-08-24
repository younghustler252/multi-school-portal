import { ISchoolRepository } from "../../school/repositories/school.repository";
import { addBulkReportCardJob } from "../../../infrastructure/jobs/queues/report-card-generation.queue";
import { NotFoundError }     from "../../../shared/errors/domain.errors";
import { BulkGenerateReportCardDtoType } from "../dtos/report-card.dto";

interface Dependencies {
    schoolRepository: ISchoolRepository;
}

export class BulkGenerateReportCardsUseCase {
    private readonly schoolRepository: ISchoolRepository;

    constructor({ schoolRepository }: Dependencies) {
        this.schoolRepository = schoolRepository;
    }

    async execute(
        dto:      BulkGenerateReportCardDtoType,
        schoolId: string,
        userId:   string,
    ): Promise<{ message: string; jobId: string }> {
        const school = await this.schoolRepository.findById(schoolId);

        if (!school || !school.schemaName) {
            throw new NotFoundError("School");
        }

        const jobId = await addBulkReportCardJob({
            schoolId,
            schemaName:        school.schemaName,
            termId:            dto.termId,
            classId:           dto.classId,
            principalRemark:   dto.principalRemark,
            triggeredByUserId: userId,
        });

        return {
            message: "Report card generation started. This may take a few minutes for large classes.",
            jobId,
        };
    }
}