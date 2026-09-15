import { ISchoolRepository }          from "../../repositories/school.repository";
import { SchoolApprovalCheckerService } from "../../services/school-approval-checker.service";
import { SchoolDocumentMapper, SchoolDocumentResponseData } from "../../mappers/school.mapper";
import { AuditService } from "../../../audit/services/audit.service";
import { NotFoundError }              from "../../../../shared/errors/domain.errors";
import { ApproveDocumentDtoType }     from "../../dtos/school.dto";

interface Dependencies {
    schoolRepository:             ISchoolRepository;
    schoolDocumentMapper:         SchoolDocumentMapper;
    schoolApprovalCheckerService: SchoolApprovalCheckerService;
    auditService:                 AuditService;
}

export class ApproveDocumentUseCase {
    private readonly schoolRepository:             ISchoolRepository;
    private readonly schoolDocumentMapper:         SchoolDocumentMapper;
    private readonly schoolApprovalCheckerService: SchoolApprovalCheckerService;
    private readonly auditService:                 AuditService;

    constructor({
        schoolRepository,
        schoolDocumentMapper,
        schoolApprovalCheckerService,
        auditService,
    }: Dependencies) {
        this.schoolRepository             = schoolRepository;
        this.schoolDocumentMapper         = schoolDocumentMapper;
        this.schoolApprovalCheckerService = schoolApprovalCheckerService;
        this.auditService                 = auditService;
    }

    async execute(
        dto:               ApproveDocumentDtoType,
        approvedByAdminId: string,
    ): Promise<SchoolDocumentResponseData> {

        // ── Find document ─────────────────────────────────────────────────
        const document = await this.schoolRepository.findDocumentById(dto.documentId);
        if (!document) throw new NotFoundError("School verification document not found.");

        // ── Approve document ──────────────────────────────────────────────
        const verifiedAt = new Date();

        const updatedDocument = await this.schoolRepository.updateDocument(dto.documentId, {
            status:       "approved",
            verifiedAt,
            verifiedById: approvedByAdminId,
        });

        // ── Audit document approval ──────────────────────────────────────
        await this.auditService.log({
            userId:   approvedByAdminId,
            schoolId: document.schoolId,
            action:   "school_document.approved",
            entity:   "SchoolDocument",
            entityId: document.id,
            oldValue: {
                documentId: document.id,
                schoolId:   document.schoolId,
                status:     document.status,
            },
            newValue: {
                documentId: updatedDocument.id,
                schoolId:   updatedDocument.schoolId,
                status:     updatedDocument.status,
                verifiedAt: updatedDocument.verifiedAt,
                verifiedById: updatedDocument.verifiedById,
            },
        });

        // ── Check if school is ready for approval ─────────────────────────
        await this.schoolApprovalCheckerService.checkAndApproveIfReady(
            document.schoolId,
            approvedByAdminId,
        );

        return this.schoolDocumentMapper.toResponse(updatedDocument);
    }
}
