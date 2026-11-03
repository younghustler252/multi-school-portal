import { IClassRepository } from "../../repositories/class.repository";
import { ISessionRepository } from "../../../sessions/repositories/session.repository";
import { ClassPresenter, ClassResponse } from "../../services/class-presenter";
import type { Access } from "../../../../foundation/access.service";
import { viewScope } from "../../services/class-branch";

interface Dependencies { classRepository: IClassRepository; sessionRepository: ISessionRepository; classPresenter: ClassPresenter }

/* LIST CLASSES for a term (the current term when none is given), with the class teacher's name, the branch and the student count. Only classes of your branches; `branchId` narrows to one branch. */
export class GetClassesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(access: Access, termId?: string, branchId?: string): Promise<ClassResponse[]> {
        const resolved = termId ?? (await this.d.sessionRepository.findCurrentTerm())?.id ?? null;
        // Branches to show: your own (all of them when you have school-wide access), narrowed to one if asked.
        const allowed = viewScope(access);
        const branchIds = allowed === "ALL" ? (branchId ? [branchId] : undefined) : (branchId ? allowed.filter(b => b === branchId) : allowed);
        if (branchIds && branchIds.length === 0) return [];
        const rows = await this.d.classRepository.findAllClassesEnriched(resolved, branchIds);
        return this.d.classPresenter.many(rows);
    }
}
