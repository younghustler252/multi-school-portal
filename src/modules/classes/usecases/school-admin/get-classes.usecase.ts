import { IClassRepository } from "../../repositories/class.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { ClassPresenter, ClassResponse } from "../../services/class-presenter";

interface Dependencies { classRepository: IClassRepository; sessionRepository: ISessionRepository; classPresenter: ClassPresenter }

/* LIST CLASSES for a term (the current term when none is given), with the class teacher's name and the student count. */
export class GetClassesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(termId?: string): Promise<ClassResponse[]> {
        const resolved = termId ?? (await this.d.sessionRepository.findCurrentTerm())?.id ?? null;
        const rows = await this.d.classRepository.findAllClassesEnriched(resolved);
        return this.d.classPresenter.many(rows);
    }
}
