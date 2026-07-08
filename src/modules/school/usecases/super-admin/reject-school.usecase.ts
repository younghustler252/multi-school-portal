import { ISchoolRepository }  from "../../repositories/school.repository";
import { SchoolMapper }       from "../../mappers/school.mapper";
import { SchoolResponseData } from "../../mappers/school.mapper";
import { NotFoundError }      from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage } from "../../domain/school.enum";
import { RejectSchoolDtoType } from "../../dtos/school.dto";

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
}

export class RejectSchoolUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper:     SchoolMapper;

    constructor({ schoolRepository, schoolMapper }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper     = schoolMapper;
    }

    async execute(dto: RejectSchoolDtoType): Promise<SchoolResponseData> {
        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(dto.schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        // ── Update verification status to rejected ────────────────────────
        const updated = await this.schoolRepository.update(dto.schoolId, {
            verificationStatus: "REJECTED",
            status: "INACTIVE",
            // Assuming your domain entity/repo handles a rejection reason column
            suspensionReason: dto.reason, 
        });

        return this.schoolMapper.toResponse(updated);
    }
}
