import { ISchoolRepository } from "../../repositories/school.repository";
import { SchoolDocumentMapper, SchoolDocumentResponseData } from "../../mappers/school.mapper";
import { SupabaseStorageService } from "../../../../infrastructure/storage/supabase-storage.service";
import { SchoolApprovalCheckerService } from "../../services/school-approval-checker.service";
import { AuditService } from "../../../audit/services/audit.service";
import { schoolErrors } from "../../domain/school.errors";

interface Dependencies {
    schoolRepository: ISchoolRepository; schoolDocumentMapper: SchoolDocumentMapper;
    storageService: SupabaseStorageService; schoolApprovalCheckerService: SchoolApprovalCheckerService;
    auditService: AuditService;
}

// Platform realm: reviewing a school's verification documents
export class SchoolDocumentsReviewUseCase {
    constructor(private readonly d: Dependencies) {}

    async list(schoolId: string, actorUserId: string): Promise<SchoolDocumentResponseData[]> {
        const d = this.d;
        if (!(await d.schoolRepository.findById(schoolId))) throw schoolErrors.notFound();
        const docs = await d.schoolRepository.findDocumentsBySchoolId(schoolId);
        // Viewing identity documents is itself an auditable act
        await d.auditService.log({ userId: actorUserId, schoolId, action: "school_document.viewed", entity: "School", entityId: schoolId });
        return Promise.all(docs.map(async doc => {
            const r = d.schoolDocumentMapper.toResponse(doc);
            try { r.fileUrl = await d.storageService.getSignedUrl(doc.fileUrl); } catch { r.fileUrl = ""; }
            return r;
        }));
    }

    async approve(documentId: string, actorId: string): Promise<SchoolDocumentResponseData> {
        const d = this.d;
        const doc = await d.schoolRepository.findDocumentById(documentId);
        if (!doc) throw schoolErrors.documentNotFound();

        const updated = await d.schoolRepository.updateDocument(documentId, {
            status: "approved", rejectionReason: null, verifiedAt: new Date(), verifiedById: actorId,
        });
        await d.auditService.log({
            userId: actorId, schoolId: doc.schoolId, action: "school_document.approved", entity: "SchoolDocument", entityId: doc.id,
            oldValue: { status: doc.status }, newValue: { status: "approved" },
        });
        await d.schoolApprovalCheckerService.checkAndApproveIfReady(doc.schoolId, actorId);
        return d.schoolDocumentMapper.toResponse(updated);
    }

    async reject(documentId: string, actorId: string, reason: string): Promise<SchoolDocumentResponseData> {
        const d = this.d;
        const doc = await d.schoolRepository.findDocumentById(documentId);
        if (!doc) throw schoolErrors.documentNotFound();

        const updated = await d.schoolRepository.updateDocument(documentId, {
            status: "rejected", rejectionReason: reason, verifiedAt: null, verifiedById: actorId,
        });
        await d.auditService.log({
            userId: actorId, schoolId: doc.schoolId, action: "school_document.rejected", entity: "SchoolDocument", entityId: doc.id,
            oldValue: { status: doc.status }, newValue: { status: "rejected" }, metadata: { reason },
        });
        return d.schoolDocumentMapper.toResponse(updated);
    }
}
