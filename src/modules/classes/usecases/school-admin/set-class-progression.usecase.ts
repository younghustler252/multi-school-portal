import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";
import { findProgressionLoop } from "../../services/class-rules";
import { NameRef } from "../../services/class-presenter";

interface Dependencies { classRepository: IClassRepository; auditService: AuditService }
export interface ClassProgressionResponse { class: NameRef; nextClass: NameRef | null }

/*
| SET CLASS PROGRESSION: the class a class is promoted into (null = its students graduate).
| Both classes must exist, a class cannot be promoted into itself, and the chain may not loop back
| (JSS 1 → JSS 2 → JSS 1). Enrolment's promotion uses this saved chain, not ids sent by the browser.
*/
export class SetClassProgressionUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, fromId: string, toId: string | null, actor: ClassActor): Promise<ClassProgressionResponse> {
        const { classRepository: repo } = this.d;
        const from = await repo.findClassById(fromId);
        if (!from) throw classErrors.notFound();
        let to = null;
        if (toId) {
            if (toId === fromId) throw classErrors.progressionSelf();
            to = await repo.findClassById(toId);
            if (!to) throw classErrors.notFound();
            const names = new Map((await repo.findAllClasses()).map(c => [c.id, c.name]));
            const loop = await findProgressionLoop(fromId, toId, async id => (await repo.findClassProgression(id))?.toClassId ?? null, id => names.get(id) ?? id);
            if (loop) throw classErrors.progressionLoop(loop);
        }

        const before = await repo.findClassProgressionEnriched(fromId);
        await repo.setClassProgression({ fromClassId: fromId, toClassId: toId });
        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "class.progression_set", entity: "Class", entityId: fromId,
            oldValue: { class: from.name, nextClass: before?.toClassName ?? null }, newValue: { nextClass: to?.name ?? null },
        });
        return { class: { id: from.id, name: from.name }, nextClass: to ? { id: to.id, name: to.name } : null };
    }
}
