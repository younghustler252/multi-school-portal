import { ISchoolRepository }        from "../../repositories/school.repository";
import { SchoolApprovalCheckerService } from "../../services/school-approval-checker.service";
import { SchoolDocumentMapper, SchoolDocumentResponseData } from "../../mappers/school.mapper";
import { NotFoundError }            from "../../../../shared/errors/domain.errors";
import { ApproveDocumentDtoType }   from "../../dtos/school.dto";

interface Dependencies {
    schoolRepository:            ISchoolRepository;
    schoolDocumentMapper:        SchoolDocumentMapper;
    schoolApprovalCheckerService: SchoolApprovalCheckerService;
}

export class ApproveDocumentUseCase {
    private readonly schoolRepository:             ISchoolRepository;
    private readonly schoolDocumentMapper:         SchoolDocumentMapper;
    private readonly schoolApprovalCheckerService: SchoolApprovalCheckerService;

    constructor({ schoolRepository, schoolDocumentMapper, schoolApprovalCheckerService }: Dependencies) {
        this.schoolRepository             = schoolRepository;
        this.schoolDocumentMapper         = schoolDocumentMapper;
        this.schoolApprovalCheckerService = schoolApprovalCheckerService;
    }

    async execute(dto: ApproveDocumentDtoType, approvedByAdminId: string): Promise<SchoolDocumentResponseData> {
        const document = await this.schoolRepository.findDocumentById(dto.documentId);
        if (!document) throw new NotFoundError("School verification document not found.");

        const updatedDocument = await this.schoolRepository.updateDocument(dto.documentId, {
            status:       "approved",
            verifiedAt:   new Date(),
            verifiedById: approvedByAdminId,
        });

        await this.schoolApprovalCheckerService.checkAndApproveIfReady(document.schoolId, approvedByAdminId);

        return this.schoolDocumentMapper.toResponse(updatedDocument);
    }
}