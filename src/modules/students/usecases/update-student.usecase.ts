import { AuditService } from "../../audit/services/audit.service";
import { IStudentRepository } from "../repositories/student.repository";
import { StudentMapper, StudentResponseData } from "../mappers/student.mapper";
import { studentErrors } from "../domain/student.errors";
import { StudentActor } from "../domain/student.types";
import { UpdateStudentDtoType } from "../dtos/student.dto";

interface Dependencies { studentRepository: IStudentRepository; studentMapper: StudentMapper; auditService: AuditService; }

const DATE_FIELDS = new Set(["dateOfBirth", "admittedAt"]);
// Compare values the way a person would: dates by day, nothing and null are the same
const plain = (key: string, v: unknown): unknown => {
    if (v === undefined || v === null) return null;
    if (DATE_FIELDS.has(key)) return new Date(v as string | Date).toISOString().slice(0, 10);
    return v;
};

/*
| UPDATE STUDENT. Only fields that really change are written and audited (old and new value).
| Changing the admission number checks that nobody else has it.
*/
export class UpdateStudentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: UpdateStudentDtoType, actor: StudentActor): Promise<StudentResponseData> {
        const d = this.d;
        const student = await d.studentRepository.findById(id);
        if (!student) throw studentErrors.notFound();

        const data: Record<string, unknown> = {};
        const before: Record<string, unknown> = {};
        const after: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(dto)) {
            if (value === undefined) continue;
            const current = (student as unknown as Record<string, unknown>)[key];
            if (plain(key, current) === plain(key, value)) continue;
            data[key] = DATE_FIELDS.has(key) && value !== null ? new Date(value as string) : value;
            before[key] = plain(key, current);
            after[key] = plain(key, value);
        }
        if (Object.keys(data).length === 0) return d.studentMapper.toResponse(student);   // nothing changed

        if (typeof data.admissionNumber === "string") {
            const other = await d.studentRepository.findByAdmissionNumber(data.admissionNumber);
            if (other && other.id !== id) throw studentErrors.admissionNumberTaken();
        }

        let updated;
        try { updated = await d.studentRepository.update(id, data); }
        catch (err: any) { if (err?.code === "P2002") throw studentErrors.admissionNumberTaken(); throw err; }

        await d.auditService.log({
            userId: actor.userId, schoolId, action: "student.updated", entity: "Student", entityId: id,
            oldValue: before, newValue: after,
        });
        return d.studentMapper.toResponse(updated);
    }
}
