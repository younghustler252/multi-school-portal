import { IGradeRepository } from "../repositories/grade.repository";
import { IStaffRepository } from "../../staff/repositories/staff.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { GradeMapper, GradeResponseData } from "../mappers/grade.mapper";
import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../../../shared/errors/domain.errors";
import { GradeErrorMessage } from "../domain/grade.enums";
import { EnterGradeDtoType } from "../dtos/grade.dto";
import { Role } from "../../../generated/public";

interface Dependencies {
    gradeRepository: IGradeRepository;
    staffRepository: IStaffRepository;
    classRepository: IClassRepository;
    gradeMapper: GradeMapper;
}

export class EnterGradeUseCase {
    private readonly gradeRepository: IGradeRepository;
    private readonly staffRepository: IStaffRepository;
    private readonly classRepository: IClassRepository;
    private readonly gradeMapper: GradeMapper;

    constructor({
        gradeRepository,
        staffRepository,
        classRepository,
        gradeMapper,
    }: Dependencies) {
        this.gradeRepository = gradeRepository;
        this.staffRepository = staffRepository;
        this.classRepository = classRepository;
        this.gradeMapper = gradeMapper;
    }

    async execute(
        dto: EnterGradeDtoType,
        requestingUserId: string,
        requestingUserRole: Role,
    ): Promise<GradeResponseData> {
        const classSubject =
            await this.classRepository.findClassSubjectById(
                dto.classSubjectId,
            );

        if (!classSubject) {
            throw new NotFoundError(
                "Class subject assignment not found",
            );
        }

        if (requestingUserRole === Role.teacher) {
            const staff = await this.staffRepository.findByUserId(
                requestingUserId,
            );

            if (!staff) {
                throw new NotFoundError(
                    "Staff record not found for this account",
                );
            }

            if (classSubject.staffId !== staff.id) {
                throw new ForbiddenError(
                    "You are not the assigned teacher for this subject.",
                );
            }
        }

        const existing =
            await this.gradeRepository.findByStudentTermSubject(
                dto.studentId,
                dto.termId,
                dto.classSubjectId,
            );

        if (existing) {
            throw new ConflictError(
                GradeErrorMessage.ALREADY_EXISTS,
            );
        }

        const caScore = dto.caScore ?? 0;
        const examScore = dto.examScore ?? 0;
        const total = caScore + examScore;

        const { grade, remark } =
            await this.calculateGrade(total);

        const gradeRecord =
            await this.gradeRepository.create({
                studentId: dto.studentId,
                termId: dto.termId,
                classSubjectId: dto.classSubjectId,
                caScore: dto.caScore,
                examScore: dto.examScore,
                total,
                grade,
                remark,
                isPublished: false,
            });

        return this.gradeMapper.toResponse(gradeRecord);
    }

    private async calculateGrade(
        total: number,
    ): Promise<{
        grade: string;
        remark: string;
    }> {
        const configs =
            await this.gradeRepository.findGradingConfigs();

        const config = configs.find(
            c =>
                total >= c.minScore &&
                total <= c.maxScore,
        );

        return {
            grade: config?.grade ?? "F9",
            remark: config?.remark ?? "Fail",
        };
    }
}
