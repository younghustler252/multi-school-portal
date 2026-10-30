import { IClassRepository } from "../../repositories/class.repository";
import { SubjectPresenter, SubjectResponse } from "../../services/subject-presenter";

interface Dependencies { classRepository: IClassRepository; subjectPresenter: SubjectPresenter }

/* ALL SUBJECTS with their default teacher's name. */
export class GetSubjectsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(): Promise<SubjectResponse[]> {
        return this.d.subjectPresenter.subjects(await this.d.classRepository.findAllSubjects());
    }
}
