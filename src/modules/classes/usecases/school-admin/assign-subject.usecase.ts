import { IClassRepository }      from "../../repositories/class.repository";
import { IStaffRepository }      from "../../../staff/repositories/staff.repository";
import { ClassSubjectMapper }    from "../../mappers/class.mapper";
import { ClassSubjectResponseData } from "../../types/class.types";
import {
    NotFoundError,
    ConflictError,
}                                from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage }     from "../../domain/class.enums";
import { AssignSubjectDtoType }  from "../../dtos/class.dto";

/*
|--------------------------------------------------------------------------
| ASSIGN SUBJECT USE CASE
| Assigns a subject to a class with a teacher
|--------------------------------------------------------------------------
*/

interface Dependencies {
    classRepository:    IClassRepository;
    staffRepository:    IStaffRepository;
    classSubjectMapper: ClassSubjectMapper;
}

export class AssignSubjectUseCase {
    private readonly classRepository:    IClassRepository;
    private readonly staffRepository:    IStaffRepository;
    private readonly classSubjectMapper: ClassSubjectMapper;

    constructor({
        classRepository,
        staffRepository,
        classSubjectMapper,
    }: Dependencies) {
        this.classRepository    = classRepository;
        this.staffRepository    = staffRepository;
        this.classSubjectMapper = classSubjectMapper;
    }

    async execute(
        classId: string,
        dto:     AssignSubjectDtoType,
    ): Promise<ClassSubjectResponseData> {

        // ── Check class exists ────────────────────────────────────────────
        const cls = await this.classRepository.findClassById(classId);
        if (!cls) throw new NotFoundError(ClassErrorMessage.NOT_FOUND);

        // ── Check subject exists ──────────────────────────────────────────
        const subject = await this.classRepository
            .findSubjectById(dto.subjectId);
        if (!subject) {
            throw new NotFoundError(ClassErrorMessage.SUBJECT_NOT_FOUND);
        }

        // ── Check staff exists ────────────────────────────────────────────
        const staff = await this.staffRepository.findById(dto.staffId);
        if (!staff) {
            throw new NotFoundError(ClassErrorMessage.STAFF_NOT_FOUND);
        }

        // ── Check not already assigned ────────────────────────────────────
        const existing = await this.classRepository.findClassSubject(
            classId,
            dto.subjectId,
        );

        if (existing) {
            throw new ConflictError(ClassErrorMessage.ALREADY_ASSIGNED);
        }

        // ── Assign ────────────────────────────────────────────────────────
        const assignment = await this.classRepository.assignSubject({
            classId,
            subjectId: dto.subjectId,
            staffId:   dto.staffId,
        });

        return this.classSubjectMapper.toResponse(assignment);
    }
}