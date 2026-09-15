import { ISchoolRepository }  from "../../repositories/school.repository";
import { SchoolDocumentMapper, SchoolDocumentResponseData } from "../../mappers/school.mapper";
import { AuditService } from "../../../audit/services/audit.service";
import { NotFoundError }      from "../../../../shared/errors/domain.errors";
import { RejectDocumentDtoType } from "../../dtos/school.dto";

interface Dependencies {
    schoolRepository:     ISchoolRepository;
    schoolDocumentMapper: SchoolDocumentMapper;
    auditService:         AuditService;
}

export class RejectDocumentUseCase {
    private readonly schoolRepository:     ISchoolRepository;
    private readonly schoolDocumentMapper: SchoolDocumentMapper;
    private readonly auditService:         AuditService;

    constructor({
        schoolRepository,
        schoolDocumentMapper,
        auditService,
    }: Dependencies) {
        this.schoolRepository     = schoolRepository;
        this.schoolDocumentMapper = schoolDocumentMapper;
        this.auditService         = auditService;
    }

    async execute(
        dto:               RejectDocumentDtoType,
        rejectedByAdminId: string,
    ): Promise<SchoolDocumentResponseData> {

        // ── Find document ─────────────────────────────────────────────────
        const document = await this.schoolRepository.findDocumentById(dto.documentId);
        if (!document) {
            throw new NotFoundError("School verification document not found.");
        }

        const oldStatus = document.status;

        // ── Reject document ───────────────────────────────────────────────
        const updatedDocument = await this.schoolRepository.updateDocument(
            dto.documentId,
            {
                status:         "rejected",
                rejectionReason: dto.reason,
                verifiedAt:      null,
            },
        );

        // ── Audit document rejection ──────────────────────────────────────
        await this.auditService.log({
            userId:   rejectedByAdminId,
            schoolId: document.schoolId,
            action:   "school_document.rejected",
            entity:   "SchoolDocument",
            entityId: document.id,
            oldValue: {
                documentId: document.id,
                schoolId:   document.schoolId,
                status:     oldStatus,
            },
            newValue: {
                documentId:      updatedDocument.id,
                schoolId:        updatedDocument.schoolId,
                status:           updatedDocument.status,
                rejectionReason: updatedDocument.rejectionReason,
                verifiedAt:      updatedDocument.verifiedAt,
            },
            metadata: {
                reason: dto.reason,
            },
        });

        return this.schoolDocumentMapper.toResponse(updatedDocument);
    }
}
