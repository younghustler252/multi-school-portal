import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { SubjectPresenter, SubjectResponse } from "../../services/subject-presenter";
import { classErrors } from "../../domain/class.errors";
import { subjectWriteError } from "../../domain/class.conflicts";
import { ClassActor } from "../../domain/class.types";
import { CreateSubjectDtoType } from "../../dtos/class.dto";

interface Dependencies { classRepository: IClassRepository; subjectPresenter: SubjectPresenter; auditService: AuditService }
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/* CREATE SUBJECT. The name is unique whatever the capitals; the code (saved in capitals) is unique too. */
export class CreateSubjectUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, dto: CreateSubjectDtoType, actor: ClassActor): Promise<SubjectResponse> {
        const all = await this.d.classRepository.findAllSubjects();
        if (all.some(s => same(s.name, dto.name))) throw classErrors.subjectNameTaken();
        if (dto.code && all.some(s => s.code && same(s.code, dto.code!))) throw classErrors.subjectCodeTaken();

        const created = await this.d.classRepository.createSubject({ name: dto.name, code: dto.code, description: dto.description }).catch(err => { throw subjectWriteError(err); });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "subject.created", entity: "Subject", entityId: created.id, newValue: { name: created.name, code: created.code } });
        return (await this.d.subjectPresenter.subjects([created]))[0];
    }
}
