import { ISchoolRepository }  from "../../repositories/school.repository";
import { SchoolMapper }       from "../../mappers/school.mapper";
import { SchoolResponseData } from "../../mappers/school.mapper";
import { NotFoundError }      from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage } from "../../domain/school.enum";
import { VerifySchoolDtoType } from "../../dtos/school.dto";

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
}

export class VerifySchoolUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper:     SchoolMapper;

    constructor({ schoolRepository, schoolMapper }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper     = schoolMapper;
    }

    async execute(dto: VerifySchoolDtoType): Promise<SchoolResponseData> {
        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(dto.schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        // ── Mark as verified ──────────────────────────────────────────────
        const updated = await this.schoolRepository.update(dto.schoolId, {
            verificationStatus: "verified",
            status:             "active",
            isActive:           true,
            verifiedAt:         new Date(),
            // verifiedById:       adminId,
        });

        // await this.mailService.sendWelcome({
        //     to:         schoolAdminEmail,
        //     adminName:  schoolAdminName,
        //     schoolName: school.name,
        //     loginUrl:   `https://${school.subdomain}.${env.APP_BASE_DOMAIN}`,
        // });

        return this.schoolMapper.toResponse(updated);
    }
}
