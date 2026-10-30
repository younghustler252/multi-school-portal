import { IGradeRepository }       from "../repositories/grade.repository";
import { IStaffRepository }       from "../../staff/repositories/staff.repository";
import { IClassRepository }       from "../../classes/repositories/class.repository";
import { GradeMapper }            from "../mappers/grade.mapper";
import { GradeResponseData }      from "../mappers/grade.mapper";
import { BulkEnterGradesDtoType } from "../dtos/grade.dto";
import {
    ForbiddenError,
    NotFoundError,
} from "../../../shared/errors/domain.errors";
import { Role } from "../../../generated/public";

interface Dependencies {
    gradeRepository: IGradeRepository;
    staffRepository: IStaffRepository;
    classRepository: IClassRepository;
    gradeMapper:     GradeMapper;
}

export class BulkEnterGradesUseCase {
    private readonly gradeRepository: IGradeRepository;
    private readonly staffRepository: IStaffRepository;
    private readonly classRepository: IClassRepository;
    private readonly gradeMapper:     GradeMapper;

    constructor({
        gradeRepository,
        staffRepository,
        classRepository,
        gradeMapper,
    }: Dependencies) {
        this.gradeRepository = gradeRepository;
        this.staffRepository = staffRepository;
        this.classRepository = classRepository;
        this.gradeMapper      = gradeMapper;
    }

    async execute(
        dto: BulkEnterGradesDtoType,
        requestingUserId: string,
        requestingUserRole: Role,
    ): Promise<{
        entered: GradeResponseData[];
        skipped: string[];
    }> {
        /*
        |--------------------------------------------------------------------------
        | Teacher authorization
        |--------------------------------------------------------------------------
        | Teachers must have a staff record and must be assigned to the
        | class subject. School admins/principals do not need a staff record
        | and can enter grades without teacher ownership enforcement.
        |--------------------------------------------------------------------------
        */
        if (requestingUserRole === Role.teacher) {
            const staff = await this.staffRepository.findByUserId(
                requestingUserId,
            );

            if (!staff) {
                throw new NotFoundError(
                    "Staff record not found for this account",
                );
            }

            const classSubject =
                await this.classRepository.findClassSubjectById(
                    dto.classSubjectId,
                );

            if (!classSubject) {
                throw new NotFoundError(
                    "Class subject assignment not found",
                );
            }

            if (classSubject.staffId !== staff.id) {
                throw new ForbiddenError(
                    "You are not the assigned teacher for this subject.",
                );
            }
        }

        const configs = await this.gradeRepository.findGradingConfigs();

        const entered: GradeResponseData[] = [];
        const skipped: string[] = [];

        for (const record of dto.grades) {
            const existing =
                await this.gradeRepository.findByStudentTermSubject(
                    record.studentId,
                    dto.termId,
                    dto.classSubjectId,
                );

            /*
            |--------------------------------------------------------------------------
            | Update existing grade
            |--------------------------------------------------------------------------
            */
            if (existing) {
                const caScore = record.caScore ?? 0;
                const examScore = record.examScore ?? 0;
                const total = caScore + examScore;

                const config = configs.find(
                    c => total >= c.minScore && total <= c.maxScore,
                );

                const grade = await this.gradeRepository.update(
                    existing.id,
                    {
                        caScore: record.caScore,
                        examScore: record.examScore,
                        total,
                        grade: config?.grade ?? "F9",
                        remark: config?.remark ?? "Fail",
                    },
                );

                entered.push(
                    this.gradeMapper.toResponse(grade),
                );

                continue;
            }

            /*
            |--------------------------------------------------------------------------
            | Create new grade
            |--------------------------------------------------------------------------
            */
            const caScore = record.caScore ?? 0;
            const examScore = record.examScore ?? 0;
            const total = caScore + examScore;

            const config = configs.find(
                c => total >= c.minScore && total <= c.maxScore,
            );

            const grade = await this.gradeRepository.create({
                studentId:      record.studentId,
                termId:         dto.termId,
                classSubjectId: dto.classSubjectId,
                caScore:        record.caScore,
                examScore:      record.examScore,
                total,
                grade:          config?.grade ?? "F9",
                remark:         config?.remark ?? "Fail",
                isPublished:    false,
            });

            entered.push(
                this.gradeMapper.toResponse(grade),
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Recalculate positions
        |--------------------------------------------------------------------------
        */
        await this.calculatePositions(
            dto.termId,
            dto.classSubjectId,
        );

        return {
            entered,
            skipped,
        };
    }

    private async calculatePositions(
        termId: string,
        classSubjectId: string,
    ): Promise<void> {
        const grades =
            await this.gradeRepository.findByTermAndSubject(
                termId,
                classSubjectId,
            );

        // Sort by total descending
        const sorted = [...grades].sort(
            (a, b) => (b.total ?? 0) - (a.total ?? 0),
        );

        const totalStudents = sorted.length;

        // Update positions
        for (let i = 0; i < sorted.length; i++) {
            await this.gradeRepository.update(
                sorted[i].id,
                {
                    position: i + 1,
                    totalStudents,
                },
            );
        }
    }
}
