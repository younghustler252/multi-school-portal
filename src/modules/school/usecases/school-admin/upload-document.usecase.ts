import { ISchoolRepository }             from "../../repositories/school.repository";
import { SchoolDocumentMapper }          from "../../mappers/school.mapper";
import { SchoolDocumentResponseData }    from "../../mappers/school.mapper";
import { SupabaseStorageService }        from "../../../../infrastructure/storage/supabase-storage.service";
import { IDocumentVerificationProvider } from "../../../../infrastructure/verification/interfaces/verification.provider.interface";
import { SchoolApprovalCheckerService }  from "../../services/school-approval-checker.service";
import {
    NotFoundError,
    BadRequestError,
}                                        from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage }            from "../../domain/school.enum";
import { UploadDocumentDtoType }         from "../../dtos/school.dto";
import { DocumentType }                  from "../../../../generated/public";

interface Dependencies {
    schoolRepository:             ISchoolRepository;
    schoolDocumentMapper:         SchoolDocumentMapper;
    storageService:               SupabaseStorageService;
    verificationProvider:         IDocumentVerificationProvider;
    schoolApprovalCheckerService: SchoolApprovalCheckerService;
}

export class UploadDocumentUseCase {
    private readonly schoolRepository:             ISchoolRepository;
    private readonly schoolDocumentMapper:         SchoolDocumentMapper;
    private readonly storageService:               SupabaseStorageService;
    private readonly verificationProvider:         IDocumentVerificationProvider;
    private readonly schoolApprovalCheckerService: SchoolApprovalCheckerService;

    constructor(deps: Dependencies) {
        this.schoolRepository             = deps.schoolRepository;
        this.schoolDocumentMapper         = deps.schoolDocumentMapper;
        this.storageService               = deps.storageService;
        this.verificationProvider         = deps.verificationProvider;
        this.schoolApprovalCheckerService = deps.schoolApprovalCheckerService;
    }

    async execute(
        schoolId: string,
        dto:      UploadDocumentDtoType,
        file: { buffer: Buffer; mimetype: string; filename: string },
    ): Promise<SchoolDocumentResponseData> {

        const school = await this.schoolRepository.findById(schoolId);
        if (!school) throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);

        const allowedMimetypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
        if (!allowedMimetypes.includes(file.mimetype)) {
            throw new BadRequestError("Invalid file type. Only PDF, JPG and PNG are allowed.");
        }

        const result = await this.storageService.upload({
            folder:   `schools/${schoolId}/documents/${dto.type}`,
            file:     file.buffer,
            mimetype: file.mimetype,
            filename: file.filename,
        });

        let apiVerified = false;
        let apiResponse: Record<string, any> | null = null;
        let status: "pending" | "under_review" | "approved" = "under_review";

        if (dto.type === "proprietor_id" && dto.idDocumentType && dto.idNumber && dto.proprietorFullName) {
            try {
                const verification = await this.verificationProvider.verifyGovernmentId({
                    idType:   dto.idDocumentType,
                    idNumber: dto.idNumber,
                    fullName: dto.proprietorFullName,
                });
                apiVerified = verification.verified;
                apiResponse = verification.rawResponse;
                status = verification.verified ? "approved" : "under_review";
            } catch (err) {
                // Provider unreachable/erroring — never block the upload on a
                // third-party outage. Falls to manual review instead.
                apiResponse = { error: err instanceof Error ? err.message : "Verification provider unavailable" };
                status = "under_review";
            }
        }

        const document = await this.schoolRepository.createDocument({
            schoolId,
            type:                  dto.type as DocumentType,
            idDocumentType:        dto.idDocumentType,
            idNumber:              dto.idNumber,
            proprietorFullName:    dto.proprietorFullName,
            proprietorDateOfBirth: dto.proprietorDateOfBirth ? new Date(dto.proprietorDateOfBirth) : undefined,
            fileUrl:               result.path,
            status,
            apiVerified,
            apiResponse: apiResponse ?? undefined,
        });

        if (status === "approved") {
            await this.schoolApprovalCheckerService.checkAndApproveIfReady(schoolId);
        }

        return this.schoolDocumentMapper.toResponse(document);
    }
}