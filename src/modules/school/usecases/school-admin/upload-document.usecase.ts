import { ISchoolRepository }        from "../../repositories/school.repository";
import { SchoolDocumentMapper }     from "../../mappers/school.mapper";
import { SchoolDocumentResponseData } from "../../mappers/school.mapper";
import { SupabaseStorageService }   from "../../../../infrastructure/storage/supabase-storage.service";
import {
    NotFoundError,
    BadRequestError,
}                                   from "../../../../shared/errors/domain.errors";
import { SchoolErrorMessage }       from "../../domain/school.enum";
import { UploadDocumentDtoType }    from "../../dtos/school.dto";
import { DocumentType }             from "../../../../generated/prisma";

/*
|--------------------------------------------------------------------------
| UPLOAD DOCUMENT USE CASE
| School admin uploads verification documents (CAC, proprietor ID etc)
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository:     ISchoolRepository;
    schoolDocumentMapper: SchoolDocumentMapper;
    storageService:       SupabaseStorageService;
}

export class UploadDocumentUseCase {
    private readonly schoolRepository:     ISchoolRepository;
    private readonly schoolDocumentMapper: SchoolDocumentMapper;
    private readonly storageService:       SupabaseStorageService;

    constructor({
        schoolRepository,
        schoolDocumentMapper,
        storageService,
    }: Dependencies) {
        this.schoolRepository     = schoolRepository;
        this.schoolDocumentMapper = schoolDocumentMapper;
        this.storageService       = storageService;
    }

    async execute(
        schoolId: string,
        dto:      UploadDocumentDtoType,
        file: {
            buffer:   Buffer;
            mimetype: string;
            filename: string;
        },
    ): Promise<SchoolDocumentResponseData> {

        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(schoolId);

        if (!school) {
            throw new NotFoundError(SchoolErrorMessage.NOT_FOUND);
        }

        // ── Validate file type ────────────────────────────────────────────
        const allowedMimetypes = [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/jpg",
        ];

        if (!allowedMimetypes.includes(file.mimetype)) {
            throw new BadRequestError(
                "Invalid file type. Only PDF, JPG and PNG are allowed.",
            );
        }

        // ── Upload to storage ─────────────────────────────────────────────
        const result = await this.storageService.upload({
            folder:   `schools/${schoolId}/documents/${dto.type}`,
            file:     file.buffer,
            mimetype: file.mimetype,
            filename: file.filename,
        });

        // ── Save document record ──────────────────────────────────────────
        const document = await this.schoolRepository.createDocument({
            schoolId,
            type:    dto.type as DocumentType,
            fileUrl: result.url,
        });

        return this.schoolDocumentMapper.toResponse(document);
    }
}