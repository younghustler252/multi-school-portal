import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { IStaffRepository } from "../../../staff/repositories/staff.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { ClassSubjectResolutionService } from "../../services/class-subject-resolution-service";
import { TeachingModelReader } from "../../services/teaching-model";
import { StaffNameLookup } from "../../services/staff-names";
import { ClassPresenter, ClassResponse } from "../../services/class-presenter";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";

interface Dependencies {
    classRepository: IClassRepository; staffRepository: IStaffRepository; sessionRepository: ISessionRepository;
    teachingModelReader: TeachingModelReader; classSubjectResolutionService: ClassSubjectResolutionService;
    staffNameLookup: StaffNameLookup; classPresenter: ClassPresenter; auditService: AuditService;
}

/*
| SET CLASS TEACHER. The teacher must be an ACTIVE staff member in the TEACHING category (the old rule looked at
| `Staff.role`, which is going away and broke custom roles). Send null to clear. In a homeroom school the class
| teacher also takes this term's subjects that have no other teacher.
*/
export class SetClassTeacherUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, classId: string, staffId: string | null, actor: ClassActor): Promise<ClassResponse> {
        const d = this.d;
        const cls = await d.classRepository.findClassById(classId);
        if (!cls) throw classErrors.notFound();
        if (staffId) {
            const staff = await d.staffRepository.findById(staffId);
            if (!staff) throw classErrors.staffNotFound();
            if (!staff.isActive || staff.category !== "teaching") throw classErrors.teacherInvalid();
        }

        const names = await d.staffNameLookup.byIds([cls.classTeacherId, staffId]);
        await d.classRepository.updateClass(classId, { classTeacherId: staffId });

        const currentTerm = await d.sessionRepository.findCurrentTerm();
        if (currentTerm && (await d.teachingModelReader.get()) === "homeroom") {
            await d.classSubjectResolutionService.recascadeHomeroom(classId, currentTerm.id);
        }
        await d.auditService.log({
            userId: actor.userId, schoolId, action: "class.teacher_set", entity: "Class", entityId: classId,
            oldValue: { class: cls.name, teacher: cls.classTeacherId ? names.get(cls.classTeacherId)?.name ?? null : null },
            newValue: { teacher: staffId ? names.get(staffId)?.name ?? null : null },
        });
        return d.classPresenter.one((await d.classRepository.findClassByIdEnriched(classId, currentTerm?.id ?? null))!);
    }
}
