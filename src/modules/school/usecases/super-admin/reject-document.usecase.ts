import { ISchoolRepository }  from "../../repositories/school.repository";
import { SchoolDocumentMapper, SchoolDocumentResponseData } from "../../mappers/school.mapper";
import { NotFoundError }      from "../../../../shared/errors/domain.errors";
import { RejectDocumentDtoType } from "../../dtos/school.dto";

interface Dependencies {
    schoolRepository:     ISchoolRepository;
    schoolDocumentMapper: SchoolDocumentMapper;
}

export class RejectDocumentUseCase {
    private readonly schoolRepository:     ISchoolRepository;
    private readonly schoolDocumentMapper: SchoolDocumentMapper;

    constructor({ schoolRepository, schoolDocumentMapper }: Dependencies) {
        this.schoolRepository     = schoolRepository;
        this.schoolDocumentMapper = schoolDocumentMapper;
    }

    async execute(dto: RejectDocumentDtoType): Promise<SchoolDocumentResponseData> {
        
        const document = await this.schoolRepository.findDocumentById(dto.documentId);
        if (!document) {
            throw new NotFoundError("School verification document not found.");
        }

        const updatedDocument = await this.schoolRepository.updateDocument(dto.documentId, {
            status: "REJECTED",
            rejectionReason: dto.reason,
            verifiedAt: null,
        });

        return this.schoolDocumentMapper.toResponse(updatedDocument);
    }
}
