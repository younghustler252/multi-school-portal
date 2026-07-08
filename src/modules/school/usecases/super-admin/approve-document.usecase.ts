import { ISchoolRepository }  from "../../repositories/school.repository";
import { SchoolDocumentMapper, SchoolDocumentResponseData } from "../../mappers/school.mapper";
import { NotFoundError }      from "../../../../shared/errors/domain.errors";
import { ApproveDocumentDtoType } from "../../dtos/school.dto";

interface Dependencies {
    schoolRepository:     ISchoolRepository;
    schoolDocumentMapper: SchoolDocumentMapper;
}

export class ApproveDocumentUseCase {
    private readonly schoolRepository:     ISchoolRepository;
    private readonly schoolDocumentMapper: SchoolDocumentMapper;

    constructor({ schoolRepository, schoolDocumentMapper }: Dependencies) {
        this.schoolRepository     = schoolRepository;
        this.schoolDocumentMapper = schoolDocumentMapper;
    }

    async execute(dto: ApproveDocumentDtoType): Promise<SchoolDocumentResponseData> {
        // 1. Verify the document exists via the repository
        const document = await this.schoolRepository.findDocumentById(dto.documentId);
        if (!document) {
            throw new NotFoundError("School verification document not found.");
        }

        // 2. Perform the database update operation
        const updatedDocument = await this.schoolRepository.updateDocument(dto.documentId, {
            status: "approved",
            verifiedAt: new Date(),
        });

        // 3. Transform clean domain entity → safe API response structure
        return this.schoolDocumentMapper.toResponse(updatedDocument);
    }
}
