import { ISchoolRepository }    from "../../repositories/school.repository";
import { SchoolMapper }         from "../../mappers/school.mapper";
import { SchoolResponseData }   from "../../mappers/school.mapper";
import { NotFoundError }        from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage }   from "../../domain/school.enum";
import { UpdateSchoolDtoType }  from "../../dtos/school.dto";

/*
|--------------------------------------------------------------------------
| UPDATE SCHOOL USE CASE
| School admin updates their own school profile
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
}

export class UpdateSchoolUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper:     SchoolMapper;

    constructor({ schoolRepository, schoolMapper }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper     = schoolMapper;
    }

    async execute(
        schoolId: string,
        dto:      UpdateSchoolDtoType,
    ): Promise<SchoolResponseData> {

        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        // ── Update ────────────────────────────────────────────────────────
        const updated = await this.schoolRepository.update(schoolId, {
            ...dto,
        });

        return this.schoolMapper.toResponse(updated);
    }
}