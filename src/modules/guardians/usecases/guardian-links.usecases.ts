import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../audit/services/audit.service";
import { IGuardianRepository } from "../repositories/guardian.repository";
import { IStudentRepository } from "../../students/repositories/student.repository";
import { guardianErrors } from "../domain/guardian.errors";
import { GuardianActor } from "../domain/guardian.types";
import { LinkGuardianDtoType, UpdateGuardianLinkDtoType } from "../dtos/guardian.dto";
import { linkInTx } from "../services/guardian-linking";

interface Dependencies { guardianRepository: IGuardianRepository; studentRepository: IStudentRepository; auditService: AuditService }

export interface GuardianLinkData { guardianId: string; studentId: string; relation: string; isPrimary: boolean }

const asPrimaryOrAlreadyLinked = (err: any, isPrimary: boolean) => {
    if (err?.code === "P2002") return isPrimary ? guardianErrors.primaryConflict() : guardianErrors.alreadyLinked();
    return err;
};

/* LINK an existing guardian to another student. One primary per student: choosing primary hands it over. */
export class LinkGuardianUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, guardianId: string, dto: LinkGuardianDtoType, actor: GuardianActor): Promise<GuardianLinkData> {
        const d = this.d;
        if (!(await d.guardianRepository.findById(guardianId))) throw guardianErrors.notFound();
        if (!(await d.studentRepository.findById(dto.studentId))) throw guardianErrors.studentNotFound();

        let result;
        try { result = await getTenantClient().$transaction(tx => linkInTx(tx as any, { guardianId, studentId: dto.studentId, relation: dto.relation, isPrimary: dto.isPrimary })); }
        catch (err) { throw asPrimaryOrAlreadyLinked(err, dto.isPrimary); }
        if (result === "already_linked") throw guardianErrors.alreadyLinked();

        await d.auditService.log({ userId: actor.userId, schoolId, action: "guardian.linked", entity: "Guardian", entityId: guardianId,
            newValue: { studentId: dto.studentId, relation: dto.relation, isPrimary: dto.isPrimary } });
        return { guardianId, studentId: dto.studentId, relation: dto.relation, isPrimary: dto.isPrimary };
    }
}

/* CHANGE a link (relationship, or make this guardian the primary / not primary). */
export class UpdateGuardianLinkUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, guardianId: string, studentId: string, dto: UpdateGuardianLinkDtoType, actor: GuardianActor): Promise<GuardianLinkData> {
        const d = this.d;
        const link = (await d.guardianRepository.findStudentLinksByGuardianId(guardianId)).find(l => l.studentId === studentId);
        if (!link) throw guardianErrors.notLinked();

        const data: Record<string, unknown> = {};
        if (dto.relation !== undefined && dto.relation !== link.relation) data.relation = dto.relation;
        if (dto.isPrimary !== undefined && dto.isPrimary !== link.isPrimary) data.isPrimary = dto.isPrimary;
        if (Object.keys(data).length === 0) return { guardianId, studentId, relation: link.relation, isPrimary: link.isPrimary };

        try {
            await getTenantClient().$transaction(async tx => {
                if (data.isPrimary === true) await tx.studentGuardian.updateMany({ where: { studentId, isPrimary: true, NOT: { guardianId } }, data: { isPrimary: false } });
                await tx.studentGuardian.update({ where: { studentId_guardianId: { studentId, guardianId } }, data });
            });
        } catch (err) { throw asPrimaryOrAlreadyLinked(err, data.isPrimary === true); }

        const now = { relation: (data.relation as string) ?? link.relation, isPrimary: (data.isPrimary as boolean) ?? link.isPrimary };
        await d.auditService.log({ userId: actor.userId, schoolId, action: "guardian.link_updated", entity: "Guardian", entityId: guardianId,
            oldValue: { studentId, relation: link.relation, isPrimary: link.isPrimary }, newValue: { studentId, ...now } });
        return { guardianId, studentId, ...now };
    }
}

/* UNLINK. The guardian and the student both stay; only the link goes. (A student may have no guardian.) */
export class UnlinkGuardianUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, guardianId: string, studentId: string, actor: GuardianActor): Promise<{ guardianId: string; studentId: string }> {
        const d = this.d;
        if (!(await d.guardianRepository.isLinked(guardianId, studentId))) throw guardianErrors.notLinked();
        await d.guardianRepository.unlinkFromStudent(guardianId, studentId);
        await d.auditService.log({ userId: actor.userId, schoolId, action: "guardian.unlinked", entity: "Guardian", entityId: guardianId, oldValue: { studentId } });
        return { guardianId, studentId };
    }
}
