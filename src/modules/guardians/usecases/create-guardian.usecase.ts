import { IGuardianRepository }   from "../repositories/guardian.repository";
import { IStudentRepository }    from "../../students/repositories/student.repository";
import { GuardianMapper }        from "../mappers/guardian.mapper";
import { GuardianResponseData }  from "../mappers/guardian.mapper";
import {
    ConflictError,
    NotFoundError,
}                                from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage }  from "../domain/guardian.enums";
import { StudentErrorMessage }   from "../../students/domain/student.enums";
import { CreateGuardianDtoType } from "../dtos/guardian.dto";

/*
|--------------------------------------------------------------------------
| CREATE GUARDIAN USE CASE
| Flow:
| 1. Check student exists
| 2. Check guardian not already linked to student
| 3. Create guardian record
| 4. Link guardian to student
|--------------------------------------------------------------------------
*/

interface Dependencies {
    guardianRepository: IGuardianRepository;
    studentRepository:  IStudentRepository;
    guardianMapper:     GuardianMapper;
}

export class CreateGuardianUseCase {
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
        dto: CreateGuardianDtoType,
    ): Promise<GuardianResponseData> {

        // ── 1. Check student exists ───────────────────────────────────────
        const student = await this.studentRepository.findById(dto.studentId);
        if (!student) {
            throw new NotFoundError(StudentErrorMessage.NOT_FOUND);
        }

        // ── 2. Check if guardian with email already exists ────────────────
        let guardian = await this.guardianRepository.findByEmail(dto.email);

        if (guardian) {
            // Guardian exists — check not already linked
            const alreadyLinked = await this.guardianRepository.isLinked(
                guardian.id,
                dto.studentId,
            );

            if (alreadyLinked) {
                throw new ConflictError(GuardianErrorMessage.ALREADY_LINKED);
            }
        } else {
            // ── 3. Create new guardian record ─────────────────────────────
            guardian = await this.guardianRepository.create({
                firstName:  dto.firstName,
                lastName:   dto.lastName,
                email:      dto.email,
                phone:      dto.phone,
                occupation: dto.occupation,
                address:    dto.address,
            });
        }

        // ── 4. Link guardian to student ───────────────────────────────────
        await this.guardianRepository.linkToStudent({
            guardianId: guardian.id,
            studentId:  dto.studentId,
            relation:   dto.relation,
            isPrimary:  dto.isPrimary,
        });

        return this.guardianMapper.toResponse(guardian);
    }
}