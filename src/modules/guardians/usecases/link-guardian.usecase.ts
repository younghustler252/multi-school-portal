import { IGuardianRepository }  from "../repositories/guardian.repository";
import { IStudentRepository }   from "../../students/repositories/student.repository";
import { GuardianMapper }       from "../mappers/guardian.mapper";
import { GuardianResponseData } from "../mappers/guardian.mapper";
import {
    NotFoundError,
    ConflictError,
}                               from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage } from "../domain/guardian.enums";
import { StudentErrorMessage }  from "../../students/domain/student.enums";
import { LinkGuardianDtoType }  from "../dtos/guardian.dto";

/*
|--------------------------------------------------------------------------
| LINK GUARDIAN USE CASE
| Links existing guardian to another student
|--------------------------------------------------------------------------
*/

interface Dependencies {
    guardianRepository: IGuardianRepository;
    studentRepository:  IStudentRepository;
    guardianMapper:     GuardianMapper;
}

export class LinkGuardianUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly studentRepository:  IStudentRepository;
    private readonly guardianMapper:     GuardianMapper;

    constructor({
        guardianRepository,
        studentRepository,
        guardianMapper,
    }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.studentRepository  = studentRepository;
        this.guardianMapper     = guardianMapper;
    }

    async execute(
        guardianId: string,
        dto:        LinkGuardianDtoType,
    ): Promise<GuardianResponseData> {

        // ── Find guardian ─────────────────────────────────────────────────
        const guardian = await this.guardianRepository.findById(guardianId);
        if (!guardian) {
            throw new NotFoundError(GuardianErrorMessage.NOT_FOUND);
        }

        // ── Find student ──────────────────────────────────────────────────
        const student = await this.studentRepository.findById(dto.studentId);
        if (!student) {
            throw new NotFoundError(StudentErrorMessage.NOT_FOUND);
        }

        // ── Check not already linked ──────────────────────────────────────
        const alreadyLinked = await this.guardianRepository.isLinked(
            guardianId,
            dto.studentId,
        );

        if (alreadyLinked) {
            throw new ConflictError(GuardianErrorMessage.ALREADY_LINKED);
        }

        // ── Link ──────────────────────────────────────────────────────────
        await this.guardianRepository.linkToStudent({
            guardianId,
            studentId:  dto.studentId,
            relation:   dto.relation,
            isPrimary:  dto.isPrimary,
        });

        return this.guardianMapper.toResponse(guardian);
    }
}