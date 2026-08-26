import { ISchoolRepository }        from "../../repositories/school.repository";
import { SchoolDocumentMapper, SchoolDocumentResponseData } from "../../mappers/school.mapper";
import { SupabaseStorageService }   from "../../../../infrastructure/storage/supabase-storage.service";
import { NotFoundError }            from "../../../../shared/errors/domain.errors";

interface Dependencies {
    schoolRepository:     ISchoolRepository;
    schoolDocumentMapper: SchoolDocumentMapper;
    storageService:       SupabaseStorageService;
}

export class GetSchoolDocumentsUseCase {
    private readonly schoolRepository:     ISchoolRepository;
    private readonly schoolDocumentMapper: SchoolDocumentMapper;
    private readonly storageService:       SupabaseStorageService;

    constructor({ schoolRepository, schoolDocumentMapper, storageService }: Dependencies) {
        this.schoolRepository     = schoolRepository;
        this.schoolDocumentMapper = schoolDocumentMapper;
        this.storageService       = storageService;
    }

    async execute(schoolId: string): Promise<SchoolDocumentResponseData[]> {
        const school = await this.schoolRepository.findById(schoolId);
        if (!school) throw new NotFoundError("School");

        const documents = await this.schoolRepository.findDocumentsBySchoolId(schoolId);

        return Promise.all(
            documents.map(async doc => {
                const response = this.schoolDocumentMapper.toResponse(doc);
                try {
                    response.fileUrl = await this.storageService.getSignedUrl(doc.fileUrl);
                } catch {
                    response.fileUrl = "";
                }
                return response;
            }),
        );
    }
}