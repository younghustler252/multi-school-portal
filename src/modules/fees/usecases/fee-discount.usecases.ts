import { IFeeDiscountRepository } from "../repositories/fee-discount.repository";
import { FeeDiscountRuleMapper, StudentDiscountMapper } from "../mappers/fee-discount.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { feeErrors } from "../domain/fee.errors";
import { assertDiscountValue } from "../domain/fee.policy";
import { FeeDiscountRuleEntity } from "../domain/fee.entity";
import { CreateDiscountRuleDtoType, UpdateDiscountRuleDtoType, ListDiscountRulesQueryType, GiveStudentDiscountDtoType } from "../dtos/fee-setup.dto";

interface Dependencies {
    feeDiscountRepository: IFeeDiscountRepository; feeDiscountRuleMapper: FeeDiscountRuleMapper; studentDiscountMapper: StudentDiscountMapper; auditService: AuditService;
}

async function loadRule(repo: IFeeDiscountRepository, id: string): Promise<FeeDiscountRuleEntity> {
    const r = await repo.findRule(id);
    if (!r) throw feeErrors.discountRuleNotFound();
    return r;
}

export class ListDiscountRulesUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListDiscountRulesQueryType) {
        return (await this.d.feeDiscountRepository.listRules({ status: q.status, kind: q.kind })).map(r => this.d.feeDiscountRuleMapper.toResponse(r));
    }
}

/* A reusable discount: a percentage (in basis points) or a fixed amount, on one fee type or on the whole invoice. */
export class CreateDiscountRuleUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: CreateDiscountRuleDtoType) {
        assertDiscountValue(dto.type, dto.value);
        if (dto.feeTypeId && !(await this.d.feeDiscountRepository.feeTypeExists(dto.feeTypeId))) throw feeErrors.feeTypeNotFound();
        const rule = await this.d.feeDiscountRepository.createRule({
            name: dto.name, kind: dto.kind, type: dto.type, value: dto.value, feeTypeId: dto.feeTypeId ?? null, createdById: actorUserId,
        });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.discount_rule.created", entity: "FeeDiscountRule", entityId: rule.id,
            newValue: { name: rule.name, kind: rule.kind, type: rule.type, value: rule.value.toString(), feeTypeId: rule.feeTypeId },
        });
        return this.d.feeDiscountRuleMapper.toResponse(rule);
    }
}

/* Changing the value affects invoices made from now on, never ones already issued. */
export class UpdateDiscountRuleUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateDiscountRuleDtoType) {
        const existing = await loadRule(this.d.feeDiscountRepository, id);
        const before = { name: existing.name, kind: existing.kind, value: existing.value.toString(), isActive: existing.isActive };
        if (dto.value !== undefined) assertDiscountValue(existing.type, dto.value);

        const updated = await this.d.feeDiscountRepository.updateRule(id, { ...dto });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.discount_rule.updated", entity: "FeeDiscountRule", entityId: id,
            oldValue: before, newValue: { name: updated.name, kind: updated.kind, value: updated.value.toString(), isActive: updated.isActive },
        });
        return this.d.feeDiscountRuleMapper.toResponse(updated);
    }
}

export class DeleteDiscountRuleUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string) {
        const existing = await loadRule(this.d.feeDiscountRepository, id);
        if ((await this.d.feeDiscountRepository.countAssignments(id)) > 0) throw feeErrors.discountRuleInUse();
        await this.d.feeDiscountRepository.deleteRule(id);
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "fees.discount_rule.deleted", entity: "FeeDiscountRule", entityId: id, oldValue: { name: existing.name } });
    }
}

export class ListStudentDiscountsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(studentId: string) {
        if (!(await this.d.feeDiscountRepository.studentExists(studentId))) throw feeErrors.studentNotFound();
        return (await this.d.feeDiscountRepository.listForStudent(studentId)).map(a => this.d.studentDiscountMapper.toResponse(a));
    }
}

/* GIVE A STUDENT A DISCOUNT, for one session or (no session) for good. The same rule is not given twice. */
export class GiveStudentDiscountUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(studentId: string, schoolId: string, actorUserId: string, dto: GiveStudentDiscountDtoType) {
        const repo = this.d.feeDiscountRepository;
        if (!(await repo.studentExists(studentId))) throw feeErrors.studentNotFound();
        const rule = await loadRule(repo, dto.ruleId);
        if (!rule.isActive) throw feeErrors.discountRuleInactive();
        if (dto.sessionId && !(await repo.sessionExists(dto.sessionId))) throw feeErrors.refNotFound("The session");
        if (await repo.findSameAssignment(studentId, dto.ruleId, dto.sessionId ?? null)) throw feeErrors.discountAlreadyGiven();

        const given = await repo.assign({ studentId, ruleId: dto.ruleId, sessionId: dto.sessionId ?? null, note: dto.note ?? null, createdById: actorUserId });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.student_discount.given", entity: "StudentDiscount", entityId: given.id,
            newValue: { studentId, ruleId: dto.ruleId, rule: rule.name, sessionId: dto.sessionId ?? null },
        });
        return this.d.studentDiscountMapper.toResponse(given);
    }
}

export class RemoveStudentDiscountUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(studentId: string, assignmentId: string, schoolId: string, actorUserId: string) {
        const existing = await this.d.feeDiscountRepository.findAssignment(assignmentId);
        if (!existing || existing.studentId !== studentId) throw feeErrors.studentDiscountNotFound();
        await this.d.feeDiscountRepository.removeAssignment(assignmentId);
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.student_discount.removed", entity: "StudentDiscount", entityId: assignmentId,
            oldValue: { studentId, ruleId: existing.ruleId, sessionId: existing.sessionId },
        });
    }
}
