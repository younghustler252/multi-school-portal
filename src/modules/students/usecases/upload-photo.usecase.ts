import { IStudentRepository }      from "../repositories/student.repository";
import { StudentMapper }           from "../mappers/student.mapper";
import { StudentResponseData }     from "../mappers/student.mapper";
import { SupabaseStorageService }  from "../../../infrastructure/storage/supabase-storage.service";
import { NotFoundError }           from "../../../shared/errors/domain.errors";
import { StudentErrorMessage }     from "../domain/student.enums";

/*
|--------------------------------------------------------------------------
| UPLOAD PHOTO USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    studentRepository: IStudentRepository;
    studentMapper:     StudentMapper;
    storageService:    SupabaseStorageService;
}

export class UploadStudentPhotoUseCase {
    private readonly studentRepository: IStudentRepository;
    private readonly studentMapper:     StudentMapper;
    private readonly storageService:    SupabaseStorageService;

    constructor({
        studentRepository,
        studentMapper,
        storageService,
    }: Dependencies) {
        this.studentRepository = studentRepository;
        this.studentMapper     = studentMapper;
        this.storageService    = storageService;
    }

    async execute(
        id:       string,
        schoolId: string,
        file: {
            buffer:   Buffer;
            mimetype: string;
            filename: string;
        },
    ): Promise<StudentResponseData> {

        const student = await this.studentRepository.findById(id);
        if (!student) {
            throw new NotFoundError(StudentErrorMessage.NOT_FOUND);
        }

        const result = await this.storageService.upload({
            folder:   `students/${schoolId}/photos`,
            file:     file.buffer,
            mimetype: file.mimetype,
            filename: file.filename,
        });

        const updated = await this.studentRepository.update(id, {
            photoUrl: result.url,
        });

        return this.studentMapper.toResponse(updated);
    }
}