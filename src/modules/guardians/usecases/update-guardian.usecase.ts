import { AuditService } from "../../audit/services/audit.service";
import { IGuardianRepository } from "../repositories/guardian.repository";
import { GuardianMapper, GuardianResponseData } from "../mappers/guardian.mapper";
import { guardianErrors } from "../domain/guardian.errors";
import { normalizeEmail } from "../domain/guardian.policy";
import { GuardianActor } from "../domain/guardian.types";
import { UpdateGuardianDtoType } from "../dtos/guardian.dto";

interface Dependencies { guardianRepository: IGuardianRepository; guardianMapper: GuardianMapper; auditService: AuditService }

/*
| UPDATE GUARDIAN. Only fields that really change are written and audited (old and new value).
| EMAIL: a guardian who already has a portal login keeps their email until the User module has a proper
| email-change flow (otherwise the guardian record and the login would show different emails).
*/
export class UpdateGuardianUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: UpdateGuardianDtoType, actor: GuardianActor): Promise<GuardianResponseData> {
        const d = this.d;
        const guardian = await d.guardianRepository.findById(id);
        if (!guardian) throw guardianErrors.notFound();

        const data: Record<string, unknown> = {}, before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
        for (const [key, raw] of Object.entries(dto)) {
            if (raw === undefined) continue;
            const value = key === "email" ? normalizeEmail(raw as string) : raw;
            const current = (guardian as unknown as Record<string, unknown>)[key] ?? null;
            if (current === value) continue;
            data[key] = value; before[key] = current; after[key] = value;
        }
        if (Object.keys(data).length === 0) return d.guardianMapper.toResponse(guardian);   // nothing changed

        if (typeof data.email === "string") {
            if (guardian.userId) throw guardianErrors.hasLogin();
            const other = await d.guardianRepository.findByEmail(data.email);
            if (other && other.id !== id) throw guardianErrors.emailTaken();
        }

        const updated = await d.guardianRepository.update(id, data);
        await d.auditService.log({ userId: actor.userId, schoolId, action: "guardian.updated", entity: "Guardian", entityId: id, oldValue: before, newValue: after });
        return d.guardianMapper.toResponse(updated);
    }
}
