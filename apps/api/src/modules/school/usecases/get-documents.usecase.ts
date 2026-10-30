import { ISchoolRepository } from "../repositories/school.repository";
import { SchoolDocumentMapper, SchoolDocumentResponseData } from "../mappers/school.mapper";
import { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { schoolErrors } from "../domain/school.errors";

interface Dependencies { schoolRepository: ISchoolRepository; schoolDocumentMapper: SchoolDocumentMapper; storageService: SupabaseStorageService }

// The school's own documents, each with a short-lived signed link (never the storage path)
export class GetDocumentsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string): Promise<SchoolDocumentResponseData[]> {
        const d = this.d;
        if (!(await d.schoolRepository.findById(schoolId))) throw schoolErrors.notFound();
        const docs = await d.schoolRepository.findDocumentsBySchoolId(schoolId);
        return Promise.all(docs.map(async doc => {
            const r = d.schoolDocumentMapper.toResponse(doc);
            try { r.fileUrl = await d.storageService.getSignedUrl(doc.fileUrl); } catch { r.fileUrl = ""; }
            return r;
        }));
    }
}
