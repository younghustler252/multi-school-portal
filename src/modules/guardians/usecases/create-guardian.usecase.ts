import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../audit/services/audit.service";
import { IStudentRepository } from "../../students/repositories/student.repository";
import { GuardianMapper, GuardianResponseData } from "../mappers/guardian.mapper";
import { guardianErrors } from "../domain/guardian.errors";
import { normalizeEmail, isGuardianEmailConflict } from "../domain/guardian.policy";
import { GuardianActor, GuardianOutcome, InviteStatus } from "../domain/guardian.types";
import { CreateGuardianDtoType } from "../dtos/guardian.dto";
import { createOrReuseGuardianInTx } from "../services/guardian-linking";
import { InviteGuardianUseCase, tryInvite } from "./guardian-invites.usecases";

interface Dependencies {
    studentRepository: IStudentRepository; guardianMapper: GuardianMapper; auditService: AuditService; inviteGuardianUseCase: InviteGuardianUseCase;
}

export interface CreateGuardianResult { guardian: GuardianResponseData; outcome: GuardianOutcome; invite?: InviteStatus }

/*
|--------------------------------------------------------------------------
| CREATE GUARDIAN (and link to a student)
|  1. the student must exist
|  2. in ONE transaction: find the guardian by email in this school (any capitals) or create one, then link
|     - an existing guardian is REUSED as it is: their details are never overwritten
|     - already linked to this student: nothing changes, outcome "already_linked"
|     - isPrimary hands the primary role over; the database refuses two primaries even under a race
|  3. only after the commit: audit entry, then (if `invite: true`) the portal invitation through Auth
| No login is created here. An invitation that fails does NOT undo the saved guardian: the response says
| invite.status "failed" with a code, and the invite can be sent again later.
|--------------------------------------------------------------------------
*/
export class CreateGuardianUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, dto: CreateGuardianDtoType, actor: GuardianActor): Promise<CreateGuardianResult> {
        const d = this.d;
        if (!(await d.studentRepository.findById(dto.studentId))) throw guardianErrors.studentNotFound();

        const attempt = () => getTenantClient().$transaction(tx => createOrReuseGuardianInTx(
            tx as any,
            { firstName: dto.firstName, lastName: dto.lastName, email: normalizeEmail(dto.email), phone: dto.phone, occupation: dto.occupation, address: dto.address },
            { studentId: dto.studentId, relation: dto.relation, isPrimary: dto.isPrimary },
        ));

        let saved;
        try {
            try { saved = await attempt(); }
            // Another request created this same email a moment ago: the database refused the second copy.
            // Start again; this time the guardian is found and reused.
            catch (err: any) { if (!isGuardianEmailConflict(err)) throw err; saved = await attempt(); }
        } catch (err: any) {
            if (isGuardianEmailConflict(err)) throw guardianErrors.emailTaken();
            if (err?.code === "P2002") throw dto.isPrimary ? guardianErrors.primaryConflict() : guardianErrors.alreadyLinked();
            throw err;
        }

        const { guardian, outcome } = saved;
        if (outcome !== "already_linked") {
            await d.auditService.log({
                userId: actor.userId, schoolId, action: outcome === "created" ? "guardian.created" : "guardian.linked",
                entity: "Guardian", entityId: guardian.id,
                newValue: { guardianId: guardian.id, studentId: dto.studentId, relation: dto.relation, isPrimary: dto.isPrimary,
                            ...(outcome === "created" ? { name: `${guardian.firstName} ${guardian.lastName}`, email: guardian.email } : {}) },
            });
        }

        const result: CreateGuardianResult = { guardian: d.guardianMapper.toResponse(d.guardianMapper.toDomain(guardian)), outcome };
        if (dto.invite) result.invite = await tryInvite(() => d.inviteGuardianUseCase.execute(schoolId, guardian.id, actor));
        return result;
    }
}
