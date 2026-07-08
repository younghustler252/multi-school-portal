import { ISchoolRepository }    from "../../repositories/school.repository";
import { SchoolMapper }         from "../../mappers/school.mapper";
import { SchoolResponseData }   from "../../mappers/school.mapper";
import {
    NotFoundError,
    UnauthorizedError,
}                               from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage }   from "../../domain/school.enum";

/*
|--------------------------------------------------------------------------
| GET SCHOOL USE CASE
| School admin views their own school profile
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
}

export class GetSchoolUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper:     SchoolMapper;

    constructor({ schoolRepository, schoolMapper }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper     = schoolMapper;
    }

    async execute(schoolId: string): Promise<SchoolResponseData> {

        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        return this.schoolMapper.toResponse(school);
    }
}