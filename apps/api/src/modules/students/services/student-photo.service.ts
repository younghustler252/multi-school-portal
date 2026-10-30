import { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { StudentEntity } from "../domain/student.entity";
import { StudentMapper, StudentResponseData } from "../mappers/student.mapper";
import { PHOTO_URL_TTL_SECONDS } from "../domain/student.policy";

/*
| STUDENT PHOTO LINKS. Photos live in the PRIVATE bucket. A student is only ever read through a use case that has
| already applied the viewer's scope, so a link is only made for someone allowed to see that student.
| The link stops working after an hour (PHOTO_URL_TTL_SECONDS); deleting the file stops it at once.
| One call signs a whole page of students. If signing fails the student is still returned, just without a photo.
*/
export class StudentPhotoService {
    constructor(private readonly d: { storageService: SupabaseStorageService; studentMapper: StudentMapper }) {}

    async toResponses(students: StudentEntity[]): Promise<StudentResponseData[]> {
        const paths = [...new Set(students.map(s => s.photoUrl).filter((p): p is string => !!p && !/^https?:\/\//.test(p)))];
        let links = new Map<string, string>();
        try { links = await this.d.storageService.getSignedUrls(paths, undefined, PHOTO_URL_TTL_SECONDS); }
        catch (err) { console.warn("Student photo links could not be created:", (err as Error).message); }

        return students.map(s => ({
            ...this.d.studentMapper.toResponse(s),
            // An old full web address (from before photos were private) is passed through unchanged
            photoUrl: s.photoUrl ? (/^https?:\/\//.test(s.photoUrl) ? s.photoUrl : links.get(s.photoUrl) ?? null) : null,
        }));
    }

    async toResponse(student: StudentEntity): Promise<StudentResponseData> {
        return (await this.toResponses([student]))[0];
    }
}
