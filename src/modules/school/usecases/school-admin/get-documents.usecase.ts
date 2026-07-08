import { ISchoolRepository }          from "../../repositories/school.repository";
import { SchoolDocumentMapper }       from "../../mappers/school.mapper";
import { SchoolDocumentResponseData } from "../../mappers/school.mapper";
import { NotFoundError }              from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage }         from "../../domain/school.enum";

/*
|--------------------------------------------------------------------------
| GET DOCUMENTS USE CASE
| School admin views their uploaded verification documents
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository:     ISchoolRepository;
    schoolDocumentMapper: SchoolDocumentMapper;
}

export class GetDocumentsUseCase {
    private readonly schoolRepository:     ISchoolRepository;
    private readonly schoolDocumentMapper: SchoolDocumentMapper;

    constructor({ schoolRepository, schoolDocumentMapper }: Dependencies) {
        this.schoolRepository     = schoolRepository;
        this.schoolDocumentMapper = schoolDocumentMapper;
    }

    async execute(
        schoolId: string,
    ): Promise<SchoolDocumentResponseData[]> {

        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        // ── Get documents ─────────────────────────────────────────────────
        const documents = await this.schoolRepository
            .findDocumentsBySchoolId(schoolId);

        return documents.map(doc =>
            this.schoolDocumentMapper.toResponse(doc),
        );
    }
}