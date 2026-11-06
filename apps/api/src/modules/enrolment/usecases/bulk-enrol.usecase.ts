import { AuditService } from "../../audit/services/audit.service";
import { IEnrolmentRepository } from "../repositories/enrolment.repository";
import { IStudentRepository } from "../../students/repositories/student.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { EnrolmentPresenter, NameRef, StudentLite, TermRef } from "../services/enrolment-presenter";
import { wouldOverflow } from "../services/class-seats";
import { sameBranch } from "../services/branch-rule";
import { enrolmentErrors } from "../domain/enrolment.errors";
import { EnrolmentActor } from "../domain/enrolment.types";
import { BulkEnrolDtoType } from "../dtos/enrolment.dto";

interface Dependencies {
    enrolmentRepository: IEnrolmentRepository; studentRepository: IStudentRepository; classRepository: IClassRepository;
    enrolmentPresenter: EnrolmentPresenter; auditService: AuditService;
}

export type SkipReason = "not_found" | "inactive" | "graduated" | "already_enrolled" | "wrong_branch";
export interface BulkEnrolResult {
    class: NameRef; term: TermRef | null;
    enrolled: StudentLite[];
    skipped: Array<{ student: { id: string; name: string | null; admissionNumber?: string | null }; reason: SkipReason }>;
}

/*
| ENROL A LIST into one class. Students who cannot be enrolled are skipped and reported by NAME with a reason
| (not found, not active, already enrolled this term, a different branch from the class); the rest are saved together in ONE transaction. If the
| class cannot hold all of them the whole request is refused (CLASS_FULL) and nothing is saved.
*/
export class BulkEnrolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, dto: BulkEnrolDtoType, actor: EnrolmentActor): Promise<BulkEnrolResult> {
        const d = this.d;
        const cls = await d.classRepository.findClassById(dto.classId);
        if (!cls) throw enrolmentErrors.classNotFound();
        const term = (await d.enrolmentPresenter.termMap()).get(dto.termId);
        if (!term) throw enrolmentErrors.termNotFound();

        const ids = [...new Set(dto.studentIds)];
        const students = new Map((await d.studentRepository.findMany({ id: { in: ids } })).map(s => [s.id, s]));
        const taken = new Set((await d.enrolmentRepository.findMany({ termId: dto.termId, studentId: { in: ids } })).map(e => e.studentId));
        const lite = (id: string): StudentLite => { const s = students.get(id)!; return { id, name: [s.firstName, s.lastName].filter(Boolean).join(" "), admissionNumber: s.admissionNumber }; };

        const skipped: BulkEnrolResult["skipped"] = [];
        const toEnrol: string[] = [];
        for (const id of ids) {
            if (!students.has(id)) skipped.push({ student: { id, name: null }, reason: "not_found" });
            else if (!students.get(id)!.isActive) skipped.push({ student: lite(id), reason: "inactive" });
            else if (students.get(id)!.graduatedAt) skipped.push({ student: lite(id), reason: "graduated" });
            else if (!sameBranch(students.get(id)!.branchId, cls.branchId)) skipped.push({ student: lite(id), reason: "wrong_branch" });
            else if (taken.has(id)) skipped.push({ student: lite(id), reason: "already_enrolled" });
            else toEnrol.push(id);
        }

        if (toEnrol.length) await d.enrolmentRepository.transaction(async tx => {
            const enrolled = await tx.lockAndCount(dto.classId, dto.termId);
            if (wouldOverflow(cls.capacity, enrolled, toEnrol.length)) throw enrolmentErrors.classFull({ capacity: cls.capacity!, enrolled, requested: toEnrol.length });
            await tx.createMany(toEnrol.map(studentId => ({ studentId, classId: dto.classId, termId: dto.termId })));
        });

        if (toEnrol.length) await d.auditService.log({
            userId: actor.userId, schoolId, action: "enrolment.bulk_created", entity: "Class", entityId: dto.classId,
            newValue: { class: cls.name, term: `${term.session?.name ?? ""} ${term.name}`.trim(), students: toEnrol.map(id => lite(id).name), skipped: skipped.length },
        });
        return { class: { id: cls.id, name: cls.name }, term, enrolled: toEnrol.map(lite), skipped };
    }
}
