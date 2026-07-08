import { ISchoolRepository }  from "../../repositories/school.repository";
import { SchoolMapper, SchoolResponseData } from "../../mappers/school.mapper";
import { NotFoundError }      from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage } from "../../domain/school.enum";
import { SuspendSchoolDtoType } from "../../dtos/school.dto"; 

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
}

export class SuspendSchoolUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper:     SchoolMapper;

    constructor({ schoolRepository, schoolMapper }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper     = schoolMapper;
    }

    // 2. Change input signature from a raw string to your parsed object type
    async execute(dto: SuspendSchoolDtoType): Promise<SchoolResponseData> {
        
        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(dto.schoolId);
        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        const updatedSchool = await this.schoolRepository.update(dto.schoolId, {
            isActive: false,                
            status: "suspended",            
            suspensionReason: dto.reason,   
            suspendedAt: new Date(),       
        });

        return this.schoolMapper.toResponse(updatedSchool);
    }
}
