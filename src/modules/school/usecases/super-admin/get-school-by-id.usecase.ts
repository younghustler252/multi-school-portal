// usecases/super-admin/get-school-by-id.usecase.ts

import { ISchoolRepository }    from "../../repositories/school.repository";
import { SchoolMapper }         from "../../mappers/school.mapper";
import { SchoolResponseData }   from "../../mappers/school.mapper";
import { NotFoundError }        from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage }   from "../../domain/school.enum";

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
}

export class GetSchoolByIdUseCase {
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

        return this.schoolMapper.toResponse(school);
    }
}