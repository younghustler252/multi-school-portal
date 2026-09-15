import { IClassRepository }     from "../../classes/repositories/class.repository";
import { IEnrolmentRepository } from "../repositories/enrolment.repository";

/*
|--------------------------------------------------------------------------
| PREVIEW PROMOTION USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    classRepository:     IClassRepository;
    enrolmentRepository: IEnrolmentRepository;
}

export interface PromotionPreviewRow {
    studentId:     string;
    studentName:   string;
    fromClassId:   string;
    fromClassName: string;
    toClassId:     string | null;
    toClassName:   string | null;
}

export class PreviewPromotionUseCase {
    private readonly classRepository:     IClassRepository;
    private readonly enrolmentRepository: IEnrolmentRepository;

    constructor({
        classRepository,
        enrolmentRepository,
    }: Dependencies) {
        this.classRepository     = classRepository;
        this.enrolmentRepository = enrolmentRepository;
    }

    async execute(
        currentTermId: string,
    ): Promise<PromotionPreviewRow[]> {

        const enrolments = await this.enrolmentRepository.findMany({
            termId: currentTermId,
            status: "active",
        });

        const rows: PromotionPreviewRow[] = [];

        for (const enrolment of enrolments) {
            const progression =
                await this.classRepository.findClassProgressionEnriched(
                    enrolment.classId,
                );

            const student =
                await this.enrolmentRepository.getStudentSummary(
                    enrolment.studentId,
                );

            rows.push({
                studentId: enrolment.studentId,
                studentName: `${student.firstName} ${student.lastName}`,
                fromClassId: enrolment.classId,
                fromClassName: progression?.fromClassName ?? "Unknown",
                toClassId: progression?.toClassId ?? null,
                toClassName: progression?.toClassName ?? null,
            });
        }

        return rows;
    }
}
