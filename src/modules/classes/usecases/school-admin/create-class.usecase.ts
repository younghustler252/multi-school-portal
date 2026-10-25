import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { ClassPresenter, ClassResponse } from "../../services/class-presenter";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";
import { CreateClassDtoType } from "../../dtos/class.dto";

interface Dependencies { classRepository: IClassRepository; classPresenter: ClassPresenter; auditService: AuditService }
export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/* CREATE CLASS. The name is unique whatever the capitals ("jss 1" and "JSS 1" are the same class). */
export class CreateClassUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, dto: CreateClassDtoType, actor: ClassActor): Promise<ClassResponse> {
        const { classRepository: repo } = this.d;
        if ((await repo.findAllClasses()).some(c => sameName(c.name, dto.name))) throw classErrors.nameTaken();

        const created = await repo.createClass({ name: dto.name, level: dto.level, capacity: dto.capacity });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "class.created", entity: "Class", entityId: created.id, newValue: { name: created.name, level: created.level, capacity: created.capacity } });
        return this.d.classPresenter.one({ id: created.id, name: created.name, level: created.level, capacity: created.capacity, classTeacherId: null, studentCount: 0, createdAt: created.createdAt });
    }
}
