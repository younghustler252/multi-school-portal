import { IEnrolmentRepository } from "../repositories/enrolment.repository";

interface PromotionOverride {
    studentId: string;
    action: "promote" | "repeat" | "graduate" | "exclude";
    classId?: string;
}

interface Dependencies {
    enrolmentRepository: IEnrolmentRepository;
}

export class PromoteStudentsUseCase {
    private readonly enrolmentRepository: IEnrolmentRepository;

    constructor({ enrolmentRepository }: Dependencies) {
        this.enrolmentRepository = enrolmentRepository;
    }

    async execute(
        currentTermId: string,
        newTermId: string,
        rows: Array<{
            studentId: string;
            fromClassId: string;
            toClassId: string | null;
        }>,
        overrides: PromotionOverride[] = [],
    ) {
        const overrideMap = new Map(
            overrides.map(o => [o.studentId, o]),
        );

        const results: Array<{
            studentId: string;
            outcome: string;
        }> = [];

        for (const row of rows) {
            const override = overrideMap.get(row.studentId);

            if (override?.action === "exclude") {
                results.push({
                    studentId: row.studentId,
                    outcome: "excluded",
                });
                continue;
            }

            if (
                override?.action === "graduate" ||
                (!override && row.toClassId === null)
            ) {
                results.push({
                    studentId: row.studentId,
                    outcome: "graduated",
                });
                continue;
            }

            const targetClassId =
                override?.classId ??
                row.toClassId ??
                row.fromClassId;

            const existing =
                await this.enrolmentRepository.findByStudentAndTerm(
                    row.studentId,
                    newTermId,
                );

            if (existing) {
                results.push({
                    studentId: row.studentId,
                    outcome: "already_enrolled",
                });
                continue;
            }

            await this.enrolmentRepository.create({
                studentId: row.studentId,
                classId: targetClassId,
                termId: newTermId,
                status: "active",
            });

            results.push({
                studentId: row.studentId,
                outcome:
                    override?.action === "repeat"
                        ? "repeated"
                        : "promoted",
            });
        }

        return {
            total: results.length,
            promoted: results.filter(
                r => r.outcome === "promoted",
            ).length,
            repeated: results.filter(
                r => r.outcome === "repeated",
            ).length,
            graduated: results.filter(
                r => r.outcome === "graduated",
            ).length,
            excluded: results.filter(
                r =>
                    r.outcome === "excluded" ||
                    r.outcome === "already_enrolled",
            ).length,
            results,
        };
    }
}
