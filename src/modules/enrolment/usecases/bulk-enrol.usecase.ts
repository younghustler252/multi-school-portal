import { IEnrolmentRepository }  from "../repositories/enrolment.repository";
import { IStudentRepository }    from "../../students/repositories/student.repository";
import { IClassRepository }      from "../../classes/repositories/class.repository";
import { EnrolmentMapper }       from "../mappers/enrolment.mapper";
import { EnrolmentResponseData } from "../mappers/enrolment.mapper";
import {
    NotFoundError,
    BadRequestError,
}                                from "../../../shared/errors/domain.errors";
import { EnrolmentErrorMessage } from "../domain/enrolment.enums";
import { BulkEnrolDtoType }      from "../dtos/enrolment.dto";

/*
|--------------------------------------------------------------------------
| BULK ENROL USE CASE
| Enrols multiple students into a class at once
|--------------------------------------------------------------------------
*/

interface Dependencies {
    enrolmentRepository: IEnrolmentRepository;
    studentRepository:   IStudentRepository;
    classRepository:     IClassRepository;
    enrolmentMapper:     EnrolmentMapper;
}

export class BulkEnrolUseCase {
    private readonly enrolmentRepository: IEnrolmentRepository;
    private readonly studentRepository:   IStudentRepository;
    private readonly classRepository:     IClassRepository;
    private readonly enrolmentMapper:     EnrolmentMapper;

    constructor({
        enrolmentRepository,
        studentRepository,
        classRepository,
        enrolmentMapper,
    }: Dependencies) {
        this.enrolmentRepository = enrolmentRepository;
        this.studentRepository   = studentRepository;
        this.classRepository     = classRepository;
        this.enrolmentMapper     = enrolmentMapper;
    }

    async execute(dto: BulkEnrolDtoType): Promise<{
        enrolled: EnrolmentResponseData[];
        skipped:  string[];
    }> {

        // ── Check class exists ────────────────────────────────────────────
        const cls = await this.classRepository.findClassById(dto.classId);
        if (!cls) {
            throw new NotFoundError(EnrolmentErrorMessage.CLASS_NOT_FOUND);
        }

        // ── Check capacity ────────────────────────────────────────────────
        if (cls.capacity) {
            const currentCount = await this.enrolmentRepository
                .countByClass(dto.classId, dto.termId);

            const available = cls.capacity - currentCount;

            if (available < dto.studentIds.length) {
                throw new BadRequestError(
                    `Class can only take ${available} more student(s). You are trying to enrol ${dto.studentIds.length}.`,
                );
            }
        }

        const enrolled: EnrolmentResponseData[] = [];
        const skipped:  string[]                = [];

        for (const studentId of dto.studentIds) {
            // Check already enrolled this term
            const existing = await this.enrolmentRepository
                .findByStudentAndTerm(studentId, dto.termId);

            if (existing) {
                skipped.push(studentId);
                continue;
            }

            const enrolment = await this.enrolmentRepository.create({
                studentId,
                classId: dto.classId,
                termId:  dto.termId,
                status:  "active",
            });

            enrolled.push(this.enrolmentMapper.toResponse(enrolment));
        }

        return { enrolled, skipped };
    }
}