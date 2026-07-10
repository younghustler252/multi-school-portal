import { IEnrolmentRepository }  from "../repositories/enrolment.repository";
import { IStudentRepository }    from "../../students/repositories/student.repository";
import { IClassRepository }      from "../../classes/repositories/class.repository";
import { EnrolmentMapper }       from "../mappers/enrolment.mapper";
import { EnrolmentResponseData } from "../mappers/enrolment.mapper";
import {
    NotFoundError,
    ConflictError,
    BadRequestError,
}                                from "../../../shared/errors/domain.errors";
import { EnrolmentErrorMessage } from "../domain/enrolment.enums";
import { EnrolStudentDtoType }   from "../dtos/enrolment.dto";

/*
|--------------------------------------------------------------------------
| ENROL STUDENT USE CASE
| Assigns a student to a class for a specific term
| Flow:
| 1. Check student exists
| 2. Check class exists
| 3. Check class not full
| 4. Check student not already enrolled this term
| 5. Create enrolment
|--------------------------------------------------------------------------
*/

interface Dependencies {
    enrolmentRepository: IEnrolmentRepository;
    studentRepository:   IStudentRepository;
    classRepository:     IClassRepository;
    enrolmentMapper:     EnrolmentMapper;
}

export class EnrolStudentUseCase {
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

    async execute(
        dto: EnrolStudentDtoType,
    ): Promise<EnrolmentResponseData> {

        // ── 1. Check student exists ───────────────────────────────────────
        const student = await this.studentRepository.findById(dto.studentId);
        if (!student) {
            throw new NotFoundError(EnrolmentErrorMessage.STUDENT_NOT_FOUND);
        }

        // ── 2. Check class exists ─────────────────────────────────────────
        const cls = await this.classRepository.findClassById(dto.classId);
        if (!cls) {
            throw new NotFoundError(EnrolmentErrorMessage.CLASS_NOT_FOUND);
        }

        // ── 3. Check class not full ───────────────────────────────────────
        if (cls.capacity) {
            const currentCount = await this.enrolmentRepository
                .countByClass(dto.classId, dto.termId);

            if (currentCount >= cls.capacity) {
                throw new BadRequestError(EnrolmentErrorMessage.CLASS_FULL);
            }
        }

        // ── 4. Check not already enrolled this term ───────────────────────
        const existing = await this.enrolmentRepository
            .findByStudentAndTerm(dto.studentId, dto.termId);

        if (existing) {
            throw new ConflictError(EnrolmentErrorMessage.ALREADY_ENROLLED);
        }

        // ── 5. Create enrolment ───────────────────────────────────────────
        const enrolment = await this.enrolmentRepository.create({
            studentId: dto.studentId,
            classId:   dto.classId,
            termId:    dto.termId,
            status:    "active",
        });

        return this.enrolmentMapper.toResponse(enrolment);
    }
}