import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { SubjectPresenter, SubjectResponse } from "../../services/subject-presenter";
import { classErrors } from "../../domain/class.errors";
import { subjectWriteError } from "../../domain/class.conflicts";
import { ClassActor } from "../../domain/class.types";
import { UpdateSubjectDtoType } from "../../dtos/class.dto";

interface Dependencies { classRepository: IClassRepository; subjectPresenter: SubjectPresenter; auditService: AuditService }
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/* UPDATE SUBJECT (name, code, description). Only changed fields are written and audited. The default teacher has its own route. */
export class UpdateSubjectUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: UpdateSubjectDtoType, actor: ClassActor): Promise<SubjectResponse> {
        const { classRepository: repo } = this.d;
        const subject = await repo.findSubjectById(id);
        if (!subject) throw classErrors.subjectNotFound();

        const data: Record<string, unknown> = {}, before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
        for (const k of ["name", "code", "description"] as const) {
            const now = dto[k];
            if (now !== undefined && now !== subject[k]) { data[k] = now; before[k] = subject[k]; after[k] = now; }
        }
        if (Object.keys(data).length === 0) return (await this.d.subjectPresenter.subjects([subject]))[0];

        const others = (await repo.findAllSubjects()).filter(s => s.id !== id);
        if (typeof data.name === "string" && others.some(s => same(s.name, data.name as string))) throw classErrors.subjectNameTaken();
        if (typeof data.code === "string" && others.some(s => s.code && same(s.code, data.code as string))) throw classErrors.subjectCodeTaken();

        const updated = await repo.updateSubject(id, data).catch(err => { throw subjectWriteError(err); });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "subject.updated", entity: "Subject", entityId: id, oldValue: { subject: subject.name, ...before }, newValue: after });
        return (await this.d.subjectPresenter.subjects([updated]))[0];
    }
}
