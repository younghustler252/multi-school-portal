import { IClassRepository } from "../../repositories/class.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { ClassPresenter, ClassResponse } from "../../services/class-presenter";
import { classErrors } from "../../domain/class.errors";

interface Dependencies { classRepository: IClassRepository; sessionRepository: ISessionRepository; classPresenter: ClassPresenter }

/* ONE CLASS with its teacher's name, student count and the class it is promoted into ({ id, name }, or null = graduates). */
export class GetClassByIdUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, termId?: string): Promise<ClassResponse> {
        const resolved = termId ?? (await this.d.sessionRepository.findCurrentTerm())?.id ?? null;
        const row = await this.d.classRepository.findClassByIdEnriched(id, resolved);
        if (!row) throw classErrors.notFound();
        const progression = await this.d.classRepository.findClassProgressionEnriched(id);
        const next = progression?.toClassId ? { id: progression.toClassId, name: progression.toClassName ?? "" } : null;
        return this.d.classPresenter.one(row, next);
    }
}
