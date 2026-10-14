import { ISchoolRepository } from "../../repositories/school.repository";
import { SchoolMapper, PlatformSchoolResponseData } from "../../mappers/school.mapper";
import { ListSchoolsQueryType } from "../../dtos/school.dto";

interface Dependencies { schoolRepository: ISchoolRepository; schoolMapper: SchoolMapper }

// Platform realm. One database query (page of schools + each one's current plan): no per-school lookups.
// Student counts are NOT here (they live in each school's own database); see the single-school view.
export class ListSchoolsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: ListSchoolsQueryType) {
        const r = await this.d.schoolRepository.listForPlatform(q);
        const data: PlatformSchoolResponseData[] = r.data.map(x => this.d.schoolMapper.toPlatformResponse(x.school, x.plan, x.mrrKobo));
        return { data, meta: r.meta };
    }
}
