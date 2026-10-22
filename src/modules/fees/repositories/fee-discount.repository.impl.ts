import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { FeeDiscountRuleMapper, FeeDiscountRuleRow, StudentDiscountMapper, StudentDiscountRow } from "../mappers/fee-discount.mapper";
import { FeeDiscountRuleEntity, FeeDiscountRuleFilters, StudentDiscountEntity } from "../domain/fee.entity";
import { IFeeDiscountRepository } from "./fee-discount.repository";

const WITH_RULE = { rule: { select: { name: true } } };

/* Rules and their per-student assignments live in two tables; this repository owns both. */
export class FeeDiscountRepositoryImpl extends BaseTenantRepository<FeeDiscountRuleEntity, FeeDiscountRuleRow> implements IFeeDiscountRepository {
    protected readonly modelName = "feeDiscountRule";
    protected readonly softDelete = true;

    constructor(
        { feeDiscountRuleMapper, studentDiscountMapper }: { feeDiscountRuleMapper: FeeDiscountRuleMapper; studentDiscountMapper: StudentDiscountMapper },
    ) { super(feeDiscountRuleMapper); this.assignmentMapper = studentDiscountMapper; }

    private readonly assignmentMapper: StudentDiscountMapper;
    private assignments() { return (this.prisma as any).studentDiscount; }
    private toAssignment(raw: StudentDiscountRow | null): StudentDiscountEntity | null { return raw ? this.assignmentMapper.toDomain(raw) : null; }

    findRule(id: string) { return this.findById(id); }

    listRules(f: FeeDiscountRuleFilters) {
        const where = {
            ...(f.status === "inactive" ? { isActive: false } : f.status === "all" ? {} : { isActive: true }),
            ...(f.kind && { kind: f.kind }),
        };
        return this.findMany(where, undefined, [{ name: "asc" }]);
    }

    createRule(data: Record<string, any>) { return this.create(data); }
    updateRule(id: string, data: Record<string, any>) { return this.update(id, data); }
    deleteRule(id: string) { return this.delete(id); }

    countAssignments(ruleId: string): Promise<number> { return this.assignments().count({ where: { ruleId, deletedAt: null } }); }

    async listForStudent(studentId: string) {
        const rows: StudentDiscountRow[] = await this.assignments().findMany({ where: { studentId, deletedAt: null }, include: WITH_RULE, orderBy: { createdAt: "desc" } });
        return rows.map(r => this.assignmentMapper.toDomain(r));
    }

    async findAssignment(id: string) { return this.toAssignment(await this.assignments().findFirst({ where: { id, deletedAt: null }, include: WITH_RULE })); }

    async findSameAssignment(studentId: string, ruleId: string, sessionId: string | null) {
        return this.toAssignment(await this.assignments().findFirst({ where: { studentId, ruleId, sessionId, deletedAt: null }, include: WITH_RULE }));
    }

    async assign(data: Record<string, any>) { return this.toAssignment(await this.assignments().create({ data, include: WITH_RULE })) as StudentDiscountEntity; }

    async removeAssignment(id: string) {
        return this.toAssignment(await this.assignments().update({ where: { id }, data: { deletedAt: new Date() }, include: WITH_RULE })) as StudentDiscountEntity;
    }

    async studentExists(id: string) { return (await this.prisma.student.count({ where: { id } })) > 0; }
    async sessionExists(id: string) { return (await this.prisma.session.count({ where: { id } })) > 0; }
    async feeTypeExists(id: string) { return (await this.prisma.feeType.count({ where: { id, deletedAt: null } })) > 0; }
}
