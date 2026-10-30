import { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { AuditService } from "../../audit/services/audit.service";
import { IStudentRepository } from "../repositories/student.repository";
import { StudentResponseData } from "../mappers/student.mapper";
import { StudentPhotoService } from "../services/student-photo.service";
import { studentErrors } from "../domain/student.errors";
import { MAX_PHOTO_BYTES, isOwnPhotoPath, photoFolder } from "../domain/student.policy";
import { StudentActor } from "../domain/student.types";

interface Dependencies {
    studentRepository: IStudentRepository; studentPhotoService: StudentPhotoService;
    storageService: SupabaseStorageService; auditService: AuditService;
}

// The browser's claimed file type is not trusted: the file's first bytes must match an allowed image type
export function sniffImage(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
    if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
    if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
    return null;
}
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/*
| UPLOAD STUDENT PHOTO. Photos are PRIVATE: the file goes to the private bucket and the database keeps its storage
| path; a short-lived link is made whenever the student is read (StudentPhotoService).
|  - the file is checked by its real content and saved under a name we choose (never the uploaded name)
|  - if the database update fails, the new file is removed again
|  - after a successful replacement the previous file is removed (best effort: if that delete fails the new photo
|    still works, and the leftover is private and unreachable)
*/
export class UploadStudentPhotoUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, file: { buffer: Buffer }, actor: StudentActor): Promise<StudentResponseData> {
        const d = this.d;
        const student = await d.studentRepository.findById(id);
        if (!student) throw studentErrors.notFound();

        if (file.buffer.length === 0 || file.buffer.length > MAX_PHOTO_BYTES) throw studentErrors.invalidImage();
        const type = sniffImage(file.buffer);
        if (!type) throw studentErrors.invalidImage();

        const result = await d.storageService.upload({            // no bucket given = the private bucket
            folder: photoFolder(schoolId), file: file.buffer, mimetype: type, filename: `${id}-${Date.now()}.${EXT[type]}`,
        });

        let updated;
        try { updated = await d.studentRepository.update(id, { photoUrl: result.path }); }
        catch (err) {
            await d.storageService.delete(result.path, result.bucket).catch(() => undefined);   // do not leave an unused file behind
            throw err;
        }

        if (isOwnPhotoPath(schoolId, student.photoUrl) && student.photoUrl !== result.path) {
            await d.storageService.delete(student.photoUrl).catch(err => console.warn("Old student photo was not removed:", (err as Error).message));
        }

        await d.auditService.log({ userId: actor.userId, schoolId, action: "student.photo_changed", entity: "Student", entityId: id });
        return d.studentPhotoService.toResponse(updated);
    }
}
