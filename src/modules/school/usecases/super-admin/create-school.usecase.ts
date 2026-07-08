import { ISchoolRepository }  from "../../repositories/school.repository";
import { SchoolMapper, SchoolResponseData } from "../../mappers/school.mapper";
import { BadRequestError }    from "../../../../shared/errors/domain.errors";
import { CreateSchoolDtoType } from "../../dtos/school.dto"; // Assuming you have this defined

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
}

export class CreateSchoolUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper:     SchoolMapper;

    constructor({ schoolRepository, schoolMapper }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper     = schoolMapper;
    }

    async execute(dto: CreateSchoolDtoType): Promise<SchoolResponseData> {
        const cleanSubdomain = dto.subdomain.toLowerCase().trim();

        // ── Ensure subdomain is unique ───────────────────────────────────
        const existingSubdomain = await this.schoolRepository.findBySubdomain(cleanSubdomain);
        if (existingSubdomain) {
            throw new BadRequestError("This portal subdomain is already taken.");
        }

        // ── Persist to public schema ─────────────────────────────────────
        const school = await this.schoolRepository.create({
            ...dto,
            subdomain: cleanSubdomain,
            schemaName: `school_${cleanSubdomain}`, // Locked schema naming convention
            isActive: true
        });

        // Note: You would also dispatch your BullMQ job here to provision the structural database schema!

        return this.schoolMapper.toResponse(school);
    }
}
