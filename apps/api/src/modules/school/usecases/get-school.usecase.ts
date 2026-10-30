import { ISchoolRepository } from "../repositories/school.repository";
import { SchoolMapper, SchoolResponseData } from "../mappers/school.mapper";
import { schoolErrors } from "../domain/school.errors";

interface Dependencies { schoolRepository: ISchoolRepository; schoolMapper: SchoolMapper }

// The current school (school realm). The id comes from the host the request arrived on.
export class GetSchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string): Promise<SchoolResponseData> {
        const school = await this.d.schoolRepository.findById(schoolId);
        if (!school) throw schoolErrors.notFound();
        return this.d.schoolMapper.toResponse(school);
    }
}
