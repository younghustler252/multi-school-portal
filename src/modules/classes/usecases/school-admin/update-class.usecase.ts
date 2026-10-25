import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { ClassPresenter, ClassResponse } from "../../services/class-presenter";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";
import { UpdateClassDtoType } from "../../dtos/class.dto";
import { sameName } from "./create-class.usecase";

interface Dependencies { classRepository: IClassRepository; sessionRepository: ISessionRepository; classPresenter: ClassPresenter; auditService: AuditService }

/*
| UPDATE CLASS. Only changed fields are written and audited. A new name must be unique (any capitals).
| Capacity cannot be set below the number of students already in the class this term.
*/
export class UpdateClassUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: UpdateClassDtoType, actor: ClassActor): Promise<ClassResponse> {
        const { classRepository: repo } = this.d;
        const cls = await repo.findClassById(id);
        if (!cls) throw classErrors.notFound();
        const termId = (await this.d.sessionRepository.findCurrentTerm())?.id ?? null;

        const data: Record<string, unknown> = {}, before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
        const set = (k: "name" | "level" | "capacity", now: unknown) => { if (now !== undefined && now !== cls[k]) { data[k] = now; before[k] = cls[k]; after[k] = now; } };
        set("name", dto.name); set("level", dto.level); set("capacity", dto.capacity);

        if (typeof data.name === "string" && (await repo.findAllClasses()).some(c => c.id !== id && sameName(c.name, data.name as string))) throw classErrors.nameTaken();
        if (typeof data.capacity === "number") {
            const current = await repo.findClassByIdEnriched(id, termId);
            if (current && data.capacity < current.studentCount) throw classErrors.capacityTooLow(current.studentCount);
        }

        if (Object.keys(data).length > 0) {
            await repo.updateClass(id, data);
            await this.d.auditService.log({ userId: actor.userId, schoolId, action: "class.updated", entity: "Class", entityId: id, oldValue: { class: cls.name, ...before }, newValue: after });
        }
        return this.d.classPresenter.one((await repo.findClassByIdEnriched(id, termId))!);
    }
}
