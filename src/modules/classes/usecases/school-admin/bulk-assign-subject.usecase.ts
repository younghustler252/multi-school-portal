import { IClassRepository } from "../../repositories/class.repository";
import { ClassSubjectAssignmentSource } from "../../domain/class.enums";
import { BulkAssignSubjectsDtoType } from "../../dtos/class.dto";

interface Dependencies {
    classRepository: IClassRepository;
}

export class BulkAssignSubjectsUseCase {
    private readonly classRepository: IClassRepository;

    constructor({ classRepository }: Dependencies) {
        this.classRepository = classRepository;
    }

    async execute(classId: string, dto: BulkAssignSubjectsDtoType) {
        const results = [];

        for (const subjectId of dto.subjectIds) {
            const existing = await this.classRepository.findClassSubject(
                classId, subjectId, dto.termId,
            );

            if (existing) {
                results.push({ subjectId, status: "skipped" });
                continue;
            }

            await this.classRepository.assignSubject({
                classId, subjectId, staffId: dto.staffId,
                termId: dto.termId, assignedVia: ClassSubjectAssignmentSource.manual,
            });

            results.push({ subjectId, status: "assigned" });
        }

        return results;
    }
}