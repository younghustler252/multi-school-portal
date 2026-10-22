import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { assertWithinPlanLimit } from "../../../infrastructure/middleware/feature-gate.middleware";
import { AuditService } from "../../audit/services/audit.service";
import { NumberSequenceService } from "../../../shared/services/number-sequence.service";
import { IStudentRepository } from "../repositories/student.repository";
import { StudentMapper, StudentResponseData } from "../mappers/student.mapper";
import { studentErrors } from "../domain/student.errors";
import { ADMISSION_NUMBER_SEQUENCE, MAX_ADMISSION_TRIES, admissionYear, formatAdmissionNumber } from "../domain/student.policy";
import { StudentActor } from "../domain/student.types";
import { CreateStudentDtoType } from "../dtos/student.dto";

interface Dependencies {
    studentRepository: IStudentRepository; studentMapper: StudentMapper;
    numberSequenceService: NumberSequenceService; auditService: AuditService;
}

type Tx = Parameters<NumberSequenceService["next"]>[2] & { student: ReturnType<typeof getTenantClient>["student"] };

/**
 * Next free admission number for the year. Runs INSIDE the creating transaction, so the counter only moves
 * if the student is saved. A number someone typed by hand earlier is skipped.
 */
export async function nextAdmissionNumber(seq: NumberSequenceService, tx: Tx, admittedAt: Date): Promise<string> {
    const year = admissionYear(admittedAt);
    for (let i = 0; i < MAX_ADMISSION_TRIES; i++) {
        const candidate = formatAdmissionNumber(year, await seq.next(ADMISSION_NUMBER_SEQUENCE, year, tx));
        if (!(await tx.student.findUnique({ where: { admissionNumber: candidate }, select: { id: true } }))) return candidate;
    }
    throw studentErrors.admissionNumberFailed();
}

/*
|--------------------------------------------------------------------------
| CREATE STUDENT
| Creates the school's record of a student. NO login is created here: a portal login comes later through an
| invitation (the old version emailed a temporary password and made a login for everyone).
|  - the plan's student limit is checked first
|  - same admission number is refused; same name + date of birth asks for confirmation
|  - the admission number is made automatically (2026/0001) inside the same transaction as the record,
|    unless one was typed
|--------------------------------------------------------------------------
*/
export class CreateStudentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, dto: CreateStudentDtoType, actor: StudentActor): Promise<StudentResponseData> {
        const d = this.d;
        await assertWithinPlanLimit(schoolId, "student", 1);

        if (dto.admissionNumber && await d.studentRepository.findByAdmissionNumber(dto.admissionNumber)) throw studentErrors.admissionNumberTaken();

        if (!dto.confirmNotDuplicate && dto.dateOfBirth) {
            const dup = await d.studentRepository.findOne({
                firstName: { equals: dto.firstName, mode: "insensitive" }, lastName: { equals: dto.lastName, mode: "insensitive" },
                dateOfBirth: new Date(dto.dateOfBirth),
            });
            if (dup) throw studentErrors.possibleDuplicate(dup.id);
        }

        const admittedAt = dto.admittedAt ? new Date(dto.admittedAt) : new Date();
        const db = getTenantClient();
        let created;
        try {
            created = await db.$transaction(async tx => {
                const admissionNumber = dto.admissionNumber ?? await nextAdmissionNumber(d.numberSequenceService, tx as unknown as Tx, admittedAt);
                return tx.student.create({
                    data: {
                        admissionNumber, firstName: dto.firstName, lastName: dto.lastName, middleName: dto.middleName,
                        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                        gender: dto.gender, bloodGroup: dto.bloodGroup, address: dto.address, religion: dto.religion,
                        nationality: dto.nationality, stateOfOrigin: dto.stateOfOrigin, admittedAt, isActive: true,
                    },
                });
            });
        } catch (err: any) {
            if (err?.code === "P2002" && dto.admissionNumber) throw studentErrors.admissionNumberTaken();   // two people typed the same number at once
            throw err;
        }

        await d.auditService.log({
            userId: actor.userId, schoolId, action: "student.created", entity: "Student", entityId: created.id,
            newValue: { name: `${dto.firstName} ${dto.lastName}`, admissionNumber: created.admissionNumber },
        });
        return d.studentMapper.toResponse(d.studentMapper.toDomain(created));
    }
}
