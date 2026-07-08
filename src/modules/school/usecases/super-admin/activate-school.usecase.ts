import { ISchoolRepository }  from "../../repositories/school.repository";
import { SchoolMapper, SchoolResponseData } from "../../mappers/school.mapper";
import { NotFoundError }      from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage } from "../../domain/school.enum";

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
}

export class ActivateSchoolUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper:     SchoolMapper;

    constructor({ schoolRepository, schoolMapper }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper     = schoolMapper;
    }

    async execute(schoolId: string): Promise<SchoolResponseData> {
        const school = await this.schoolRepository.findById(schoolId);
        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        const updatedSchool = await this.schoolRepository.update(schoolId, {
            isActive: true,
            status:   "active",   
            suspendedAt:     null, 
            suspensionReason: null, 
        });

        return this.schoolMapper.toResponse(updatedSchool);
    }
}
