import { ISchoolRepository } from "../repositories/school.repository";
import { SchoolDocumentMapper, SchoolDocumentResponseData } from "../mappers/school.mapper";
import { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { IDocumentVerificationProvider } from "../../../infrastructure/verification/interfaces/verification.provider.interface";
import { SchoolApprovalCheckerService } from "../services/school-approval-checker.service";
import { EncryptionService } from "../../../shared/services/encryption.service";
import { AuditService } from "../../audit/services/audit.service";
import { sniffFile, FILE_EXTENSION } from "../../../shared/utils/file-sniff";
import { schoolErrors } from "../domain/school.errors";
import { MAX_DOCUMENTS_PER_TYPE } from "../domain/school.policy";
import { UploadDocumentDtoType } from "../dtos/school.dto";
import { DocumentType } from "../../../generated/public";

interface Dependencies {
    schoolRepository: ISchoolRepository; schoolDocumentMapper: SchoolDocumentMapper;
    storageService: SupabaseStorageService; verificationProvider: IDocumentVerificationProvider;
    schoolApprovalCheckerService: SchoolApprovalCheckerService; encryptionService: EncryptionService;
    auditService: AuditService;
}

const MAX_BYTES = 5 * 1024 * 1024;

/*
| UPLOAD VERIFICATION DOCUMENT
| - the real file type is read from the file (PDF, JPEG, PNG), the client's claim is ignored
| - a bounded number of uploads per document type
| - a government ID is checked with the verification provider when possible, and its number is
|   encrypted before saving; a provider outage never blocks the upload (it goes to manual review)
| - the first upload moves the school from "unverified" (or "rejected") to "under_review"
*/
export class UploadDocumentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(
        schoolId: string, actorUserId: string, dto: UploadDocumentDtoType, file: { buffer: Buffer },
    ): Promise<SchoolDocumentResponseData> {
        const d = this.d;
        const school = await d.schoolRepository.findById(schoolId);
        if (!school) throw schoolErrors.notFound();

        const type = sniffFile(file.buffer);
        if (!type || file.buffer.length > MAX_BYTES) throw schoolErrors.invalidFile();
        if (type === "image/webp") throw schoolErrors.invalidFile("Only PDF, JPG and PNG are accepted");

        const existing = await d.schoolRepository.findDocumentsBySchoolId(schoolId);
        if (existing.filter(x => x.type === dto.type).length >= MAX_DOCUMENTS_PER_TYPE) throw schoolErrors.tooManyDocuments();

        const stored = await d.storageService.upload({
            folder: `schools/${schoolId}/documents/${dto.type}`, file: file.buffer, mimetype: type,
            filename: `${dto.type}-${Date.now()}.${FILE_EXTENSION[type]}`,
        });

        let apiVerified = false;
        let apiResponse: Record<string, unknown> | null = null;
        let status: "under_review" | "approved" = "under_review";

        if (dto.type === "proprietor_id" && dto.idDocumentType && dto.idNumber && dto.proprietorFullName) {
            try {
                const v = await d.verificationProvider.verifyGovernmentId({
                    idType: dto.idDocumentType, idNumber: dto.idNumber, fullName: dto.proprietorFullName,
                });
                apiVerified = v.verified; apiResponse = v.rawResponse; status = v.verified ? "approved" : "under_review";
            } catch (err) {
                apiResponse = { error: err instanceof Error ? err.message : "Verification provider unavailable" };
            }
        }

        const document = await d.schoolRepository.createDocument({
            schoolId, type: dto.type as DocumentType, idDocumentType: dto.idDocumentType,
            idNumber: dto.idNumber ? d.encryptionService.encrypt(dto.idNumber) : undefined,
            proprietorFullName: dto.proprietorFullName,
            proprietorDateOfBirth: dto.proprietorDateOfBirth ? new Date(dto.proprietorDateOfBirth) : undefined,
            fileUrl: stored.path, status, apiVerified, apiResponse: (apiResponse ?? undefined) as never,
        });

        if (school.verificationStatus === "unverified" || school.verificationStatus === "rejected") {
            await d.schoolRepository.update(schoolId, { verificationStatus: "under_review" });
        }

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "school_document.uploaded", entity: "SchoolDocument", entityId: document.id,
            newValue: { type: dto.type, status, autoVerified: apiVerified },
        });

        if (status === "approved") await d.schoolApprovalCheckerService.checkAndApproveIfReady(schoolId);
        return d.schoolDocumentMapper.toResponse(document);
    }
}
