/*
|--------------------------------------------------------------------------
| FEES v2 set-up: fee types, fee structures, discount rules and student discounts, plus request validation and permissions.
| Logic only, against in-memory repositories.
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { CreateFeeTypeUseCase, UpdateFeeTypeUseCase, DeleteFeeTypeUseCase, ListFeeTypesUseCase } from "../../src/modules/fees/usecases/fee-type.usecases";
import { CreateFeeStructureUseCase, UpdateFeeStructureUseCase, DeleteFeeStructureUseCase } from "../../src/modules/fees/usecases/fee-structure.usecases";
import {
    CreateDiscountRuleUseCase, UpdateDiscountRuleUseCase, DeleteDiscountRuleUseCase, GiveStudentDiscountUseCase, RemoveStudentDiscountUseCase, ListStudentDiscountsUseCase,
} from "../../src/modules/fees/usecases/fee-discount.usecases";
import { FeeTypeMapper } from "../../src/modules/fees/mappers/fee-type.mapper";
import { FeeStructureMapper } from "../../src/modules/fees/mappers/fee-structure.mapper";
import { FeeDiscountRuleMapper, StudentDiscountMapper } from "../../src/modules/fees/mappers/fee-discount.mapper";
import { assertDiscountValue, codeFromName, FEE_TYPE_CODE } from "../../src/modules/fees/domain/fee.policy";
import { CreateFeeTypeDto, CreateFeeStructureDto, CreateDiscountRuleDto, UpdateFeeStructureDto } from "../../src/modules/fees/dtos/fee-setup.dto";
import { FEES_PERMISSIONS } from "../../src/modules/fees/fees.permissions";
import { PERMISSION_REGISTRY } from "../../src/foundation/permissions.registry";
import { ROLE_TEMPLATES } from "../../src/foundation/role-templates.registry";
import type { FeeTypeEntity, FeeStructureEntity, FeeDiscountRuleEntity, StudentDiscountEntity } from "../../src/modules/fees/domain/fee.entity";

const code = (c: string) => (e: any) => e.code === c;
const NOW = new Date("2026-10-01T00:00:00Z");

function setup() {
    const audit: any[] = [];
    const accounts = new Map<string, { id: string; type: string; isActive: boolean }>([
        ["inc", { id: "inc", type: "INCOME", isActive: true }], ["inc-off", { id: "inc-off", type: "INCOME", isActive: false }],
        ["bank", { id: "bank", type: "ASSET", isActive: true }],
    ]);
    const ledgerAccountRepository: any = { async findById(id: string) { return accounts.get(id) ?? null; } };

    const types: FeeTypeEntity[] = [];
    const usedTypes = new Set<string>();
    let seq = 0;
    const feeTypeRepository: any = {
        async findById(id: string) { return types.find(t => t.id === id && !t.deletedAt) ?? null; },
        async findByIds(ids: string[]) { return types.filter(t => ids.includes(t.id) && !t.deletedAt); },
        async listFiltered(f: any) { return types.filter(t => !t.deletedAt && (f.status === "all" || (f.status === "inactive" ? !t.isActive : t.isActive)) && (!f.q || t.name.toLowerCase().includes(f.q.toLowerCase()))); },
        async codeExists(c: string) { return types.some(t => t.code === c); },
        async isUsed(id: string) { return usedTypes.has(id); },
        async create(data: any): Promise<FeeTypeEntity> {
            const t: FeeTypeEntity = { id: `ft-${++seq}`, incomeAccountCode: "4000", incomeAccountName: "Tuition fees", description: null, isActive: true, createdAt: NOW, deletedAt: null, ...data };
            types.push(t); return t;
        },
        async update(id: string, data: any) { const t = types.find(x => x.id === id)!; Object.assign(t, data); return t; },
        async delete(id: string) { const t = types.find(x => x.id === id)!; t.deletedAt = new Date(); return t; },
    };

    const structures: FeeStructureEntity[] = [];
    const invoicesFrom = new Map<string, number>();
    const feeStructureRepository: any = {
        async findById(id: string) { return structures.find(s => s.id === id && !s.deletedAt) ?? null; },
        async findSameScope(scope: any, exceptId?: string) {
            return structures.find(s => !s.deletedAt && s.id !== exceptId && s.termId === scope.termId && s.classId === scope.classId && s.branchId === scope.branchId && s.studentType === scope.studentType) ?? null;
        },
        async createWithItems(data: any, items: any[]): Promise<FeeStructureEntity> {
            const s: FeeStructureEntity = { id: `fs-${++seq}`, description: null, isActive: true, createdAt: NOW, deletedAt: null, ...data, items: items.map((i, n) => ({ id: `fsi-${seq}-${n}`, feeTypeCode: "X", feeTypeName: "X", ...i })) };
            structures.push(s); return s;
        },
        async updateWithItems(id: string, data: any, items?: any[]) {
            const s = structures.find(x => x.id === id)!; Object.assign(s, data);
            if (items) s.items = items.map((i, n) => ({ id: `new-${n}`, feeTypeCode: "X", feeTypeName: "X", ...i }));
            return s;
        },
        async countInvoices(id: string) { return invoicesFrom.get(id) ?? 0; },
        async delete(id: string) { const s = structures.find(x => x.id === id)!; s.deletedAt = new Date(); return s; },
        async sessionExists(id: string) { return id === "sess-1"; },
        async termSessionId(id: string) { return id === "term-1" ? "sess-1" : id === "term-other" ? "sess-2" : null; },
        async classExists(id: string) { return id === "class-1"; },
        async branchExists(id: string) { return id === "branch-1"; },
    };

    const rules: FeeDiscountRuleEntity[] = [];
    const assignments: StudentDiscountEntity[] = [];
    const feeDiscountRepository: any = {
        async findRule(id: string) { return rules.find(r => r.id === id && !r.deletedAt) ?? null; },
        async listRules() { return rules; },
        async createRule(data: any): Promise<FeeDiscountRuleEntity> { const r = { id: `dr-${++seq}`, isActive: true, createdAt: NOW, deletedAt: null, ...data }; rules.push(r); return r; },
        async updateRule(id: string, data: any) { const r = rules.find(x => x.id === id)!; Object.assign(r, data); return r; },
        async deleteRule(id: string) { const r = rules.find(x => x.id === id)!; r.deletedAt = new Date(); return r; },
        async countAssignments(ruleId: string) { return assignments.filter(a => a.ruleId === ruleId && !a.deletedAt).length; },
        async listForStudent(studentId: string) { return assignments.filter(a => a.studentId === studentId && !a.deletedAt); },
        async findAssignment(id: string) { return assignments.find(a => a.id === id && !a.deletedAt) ?? null; },
        async findSameAssignment(studentId: string, ruleId: string, sessionId: string | null) { return assignments.find(a => !a.deletedAt && a.studentId === studentId && a.ruleId === ruleId && a.sessionId === sessionId) ?? null; },
        async assign(data: any): Promise<StudentDiscountEntity> { const a = { id: `sd-${++seq}`, ruleName: "x", note: null, createdAt: NOW, deletedAt: null, ...data }; assignments.push(a); return a; },
        async removeAssignment(id: string) { const a = assignments.find(x => x.id === id)!; a.deletedAt = new Date(); return a; },
        async studentExists(id: string) { return id === "stu-1"; },
        async sessionExists(id: string) { return id === "sess-1"; },
        async feeTypeExists(id: string) { return types.some(t => t.id === id); },
    };

    const d: any = {
        feeTypeRepository, feeStructureRepository, feeDiscountRepository, ledgerAccountRepository,
        feeTypeMapper: new FeeTypeMapper(), feeStructureMapper: new FeeStructureMapper(),
        feeDiscountRuleMapper: new FeeDiscountRuleMapper(), studentDiscountMapper: new StudentDiscountMapper(),
        auditService: { async log(p: any) { audit.push(p); } },
    };
    return { d, types, structures, rules, assignments, usedTypes, invoicesFrom, audit };
}

let t: ReturnType<typeof setup>;
beforeEach(() => { t = setup(); });

const addType = (over: any = {}) => new CreateFeeTypeUseCase(t.d).execute("school-1", "user-1", { name: "School Fees", incomeAccountId: "inc", isRefundable: false, sortOrder: 0, ...over });

describe("fee types", () => {
    it("creates one, making the code from the name, and audits it", async () => {
        const r = await addType();
        assert.equal(r.code, "SCHOOL_FEES");
        assert.equal(r.incomeAccount.id, "inc");
        assert.equal(t.audit[0].action, "fees.type.created");
    });

    it("refuses a taken code, and a money or inactive account as the income account", async () => {
        await addType();
        await assert.rejects(() => addType(), code("FEE_TYPE_CODE_TAKEN"));
        await assert.rejects(() => addType({ name: "Bus", incomeAccountId: "bank" }), code("INCOME_ACCOUNT_INVALID"));
        await assert.rejects(() => addType({ name: "Bus", incomeAccountId: "inc-off" }), code("INCOME_ACCOUNT_INVALID"));
        await assert.rejects(() => addType({ name: "Bus", incomeAccountId: "nope" }), code("INCOME_ACCOUNT_INVALID"));
    });

    it("keeps the old values in the audit trail when it is edited", async () => {
        const made = await addType();
        const r = await new UpdateFeeTypeUseCase(t.d).execute(made.id, "school-1", "user-1", { name: "Tuition", isRefundable: true });
        assert.equal(r.name, "Tuition");
        const log = t.audit.at(-1)!;
        assert.equal(log.oldValue.name, "School Fees");
        assert.equal(log.newValue.name, "Tuition");
    });

    it("checks a new income account only when it changes", async () => {
        const made = await addType();
        await assert.rejects(() => new UpdateFeeTypeUseCase(t.d).execute(made.id, "s", "u", { incomeAccountId: "bank" }), code("INCOME_ACCOUNT_INVALID"));
        await new UpdateFeeTypeUseCase(t.d).execute(made.id, "s", "u", { incomeAccountId: "inc", name: "Same account" });
    });

    it("deletes an unused one but protects a used one", async () => {
        const a = await addType(); const b = await addType({ name: "Uniform" });
        t.usedTypes.add(b.id);
        await new DeleteFeeTypeUseCase(t.d).execute(a.id, "s", "u");
        await assert.rejects(() => new DeleteFeeTypeUseCase(t.d).execute(b.id, "s", "u"), code("FEE_TYPE_IN_USE"));
        await assert.rejects(() => new DeleteFeeTypeUseCase(t.d).execute(a.id, "s", "u"), code("NOT_FOUND"));
    });

    it("lists active ones by default", async () => {
        const a = await addType(); await addType({ name: "Uniform" });
        await new UpdateFeeTypeUseCase(t.d).execute(a.id, "s", "u", { isActive: false });
        assert.equal((await new ListFeeTypesUseCase(t.d).execute({ status: "active" })).length, 1);
        assert.equal((await new ListFeeTypesUseCase(t.d).execute({ status: "all" })).length, 2);
    });
});

const addStructure = (over: any = {}) => new CreateFeeStructureUseCase(t.d).execute("school-1", "user-1", {
    name: "JSS1 first term", sessionId: "sess-1", termId: "term-1", classId: "class-1", studentType: "ALL",
    items: [{ feeTypeId: "ft-1", amountKobo: 5_000_000n }, { feeTypeId: "ft-2", amountKobo: 1_500_000n }], ...over,
});

describe("fee structures", () => {
    beforeEach(async () => { await addType(); await addType({ name: "Uniform" }); });

    it("creates one with its items in the order given and a total", async () => {
        const r = await addStructure({ dueDate: "2026-11-15" });
        assert.equal(r.items.length, 2);
        assert.equal(r.items[1].sortOrder, 1);
        assert.equal(r.totalKobo, 6_500_000);
        assert.equal(r.dueDate, "2026-11-15");
    });

    it("refuses a second structure for the same scope but allows another class or student type", async () => {
        await addStructure();
        await assert.rejects(() => addStructure(), code("STRUCTURE_OVERLAP"));
        await addStructure({ classId: undefined });
        await addStructure({ studentType: "NEW" });
    });

    it("checks the references", async () => {
        await assert.rejects(() => addStructure({ sessionId: "x" }), code("REFERENCE_NOT_FOUND"));
        await assert.rejects(() => addStructure({ termId: "x" }), code("REFERENCE_NOT_FOUND"));
        await assert.rejects(() => addStructure({ termId: "term-other" }), code("TERM_NOT_IN_SESSION"));
        await assert.rejects(() => addStructure({ classId: "x" }), code("REFERENCE_NOT_FOUND"));
        await assert.rejects(() => addStructure({ branchId: "x" }), code("REFERENCE_NOT_FOUND"));
    });

    it("refuses a repeated or missing or inactive fee type", async () => {
        await assert.rejects(() => addStructure({ items: [{ feeTypeId: "ft-1", amountKobo: 1n }, { feeTypeId: "ft-1", amountKobo: 2n }] }), code("DUPLICATE_STRUCTURE_ITEM"));
        await assert.rejects(() => addStructure({ items: [{ feeTypeId: "nope", amountKobo: 1n }] }), code("NOT_FOUND"));
        await new UpdateFeeTypeUseCase(t.d).execute("ft-2", "s", "u", { isActive: false });
        await assert.rejects(() => addStructure(), code("FEE_TYPE_INACTIVE"));
    });

    it("replaces the item list on edit and keeps the old one in the audit trail", async () => {
        const made = await addStructure();
        const r = await new UpdateFeeStructureUseCase(t.d).execute(made.id, "s", "u", { items: [{ feeTypeId: "ft-1", amountKobo: 7_000_000n }], dueDate: null });
        assert.equal(r.items.length, 1);
        assert.equal(r.totalKobo, 7_000_000);
        const log = t.audit.at(-1)!;
        assert.equal(log.oldValue.items.length, 2);
        assert.equal(log.newValue.items.length, 1);
    });

    it("deletes an unused structure but protects one that invoices came from", async () => {
        const a = await addStructure(); const b = await addStructure({ studentType: "NEW" });
        t.invoicesFrom.set(b.id, 3);
        await new DeleteFeeStructureUseCase(t.d).execute(a.id, "s", "u");
        await assert.rejects(() => new DeleteFeeStructureUseCase(t.d).execute(b.id, "s", "u"), code("STRUCTURE_IN_USE"));
    });
});

describe("discounts", () => {
    const addRule = (over: any = {}) => new CreateDiscountRuleUseCase(t.d).execute("school-1", "user-1", { name: "Sibling 10%", kind: "SIBLING", type: "PERCENT", value: 1000n, ...over });

    it("creates a percentage and a fixed rule, refusing out-of-range values", async () => {
        assert.equal((await addRule()).value, 1000);
        assert.equal((await addRule({ name: "Scholarship", type: "FIXED", value: 2_500_000n })).value, 2_500_000);
        await assert.rejects(() => addRule({ value: 10_001n }), code("DISCOUNT_VALUE_INVALID"));
        await assert.rejects(() => addRule({ type: "FIXED", value: 0n }), code("DISCOUNT_VALUE_INVALID"));
    });

    it("needs the fee type to exist when the rule is for one fee", async () => {
        await assert.rejects(() => addRule({ feeTypeId: "nope" }), code("NOT_FOUND"));
    });

    it("keeps a rule's type but lets its value change within the type's limits", async () => {
        const rule = await addRule();
        await new UpdateDiscountRuleUseCase(t.d).execute(rule.id, "s", "u", { value: 2000n });
        await assert.rejects(() => new UpdateDiscountRuleUseCase(t.d).execute(rule.id, "s", "u", { value: 20_000n }), code("DISCOUNT_VALUE_INVALID"));
    });

    it("gives a student a discount once per session and lets it be removed", async () => {
        const rule = await addRule();
        const give = (dto: any = {}) => new GiveStudentDiscountUseCase(t.d).execute("stu-1", "school-1", "user-1", { ruleId: rule.id, ...dto });
        const first = await give({ sessionId: "sess-1" });
        await assert.rejects(() => give({ sessionId: "sess-1" }), code("DISCOUNT_ALREADY_GIVEN"));
        await give();                                                       // for good: a different assignment
        assert.equal((await new ListStudentDiscountsUseCase(t.d).execute("stu-1")).length, 2);
        await new RemoveStudentDiscountUseCase(t.d).execute("stu-1", first.id, "s", "u");
        assert.equal((await new ListStudentDiscountsUseCase(t.d).execute("stu-1")).length, 1);
        await give({ sessionId: "sess-1" });                                 // free again after removal
    });

    it("refuses an unknown student, an inactive rule, and removing another student's discount", async () => {
        const rule = await addRule();
        await assert.rejects(() => new GiveStudentDiscountUseCase(t.d).execute("nobody", "s", "u", { ruleId: rule.id }), code("NOT_FOUND"));
        await new UpdateDiscountRuleUseCase(t.d).execute(rule.id, "s", "u", { isActive: false });
        await assert.rejects(() => new GiveStudentDiscountUseCase(t.d).execute("stu-1", "s", "u", { ruleId: rule.id }), code("DISCOUNT_RULE_INACTIVE"));
        await new UpdateDiscountRuleUseCase(t.d).execute(rule.id, "s", "u", { isActive: true });
        const given = await new GiveStudentDiscountUseCase(t.d).execute("stu-1", "s", "u", { ruleId: rule.id });
        await assert.rejects(() => new RemoveStudentDiscountUseCase(t.d).execute("stu-2", given.id, "s", "u"), code("NOT_FOUND"));
    });

    it("protects a rule that students still have", async () => {
        const rule = await addRule();
        const given = await new GiveStudentDiscountUseCase(t.d).execute("stu-1", "s", "u", { ruleId: rule.id });
        await assert.rejects(() => new DeleteDiscountRuleUseCase(t.d).execute(rule.id, "s", "u"), code("DISCOUNT_RULE_IN_USE"));
        await new RemoveStudentDiscountUseCase(t.d).execute("stu-1", given.id, "s", "u");
        await new DeleteDiscountRuleUseCase(t.d).execute(rule.id, "s", "u");
    });
});

describe("fee set-up policy and request validation", () => {
    it("builds codes from names", () => {
        assert.equal(codeFromName("Lesson/Tutorial Fee"), "LESSON_TUTORIAL_FEE");
        assert.equal(codeFromName("  PTA levy! "), "PTA_LEVY");
        assert.ok(FEE_TYPE_CODE.test("SCHOOL_FEES") && !FEE_TYPE_CODE.test("1ABC") && !FEE_TYPE_CODE.test("a"));
    });

    it("limits discount values", () => {
        assert.doesNotThrow(() => assertDiscountValue("PERCENT", 10_000n));
        assert.throws(() => assertDiscountValue("PERCENT", 0n));
        assert.doesNotThrow(() => assertDiscountValue("FIXED", 1n));
    });

    it("accepts kobo as a number or a digit string and refuses zero, negatives and unknown fields", () => {
        const body = (amount: unknown) => CreateFeeStructureDto.safeParse({ name: "x", sessionId: "s", termId: "t", items: [{ feeTypeId: "f", amountKobo: amount }] });
        const ok = body(5_000_000); assert.ok(ok.success && ok.data.items[0].amountKobo === 5_000_000n);
        const str = body("9007199254740993"); assert.ok(str.success && str.data.items[0].amountKobo === 9007199254740993n);
        for (const bad of [0, -5, 1.5, "-1", "abc"]) assert.ok(!body(bad).success, `accepted ${String(bad)}`);
        assert.ok(!CreateFeeTypeDto.safeParse({ name: "x", incomeAccountId: "a", extra: 1 }).success);
        assert.ok(!UpdateFeeStructureDto.safeParse({}).success);
        assert.ok(!UpdateFeeStructureDto.safeParse({ termId: "t2" }).success);              // scope cannot change
        assert.ok(!CreateFeeStructureDto.safeParse({ name: "x", sessionId: "s", termId: "t", items: [] }).success);
        assert.ok(CreateDiscountRuleDto.safeParse({ name: "x", type: "PERCENT", value: 1000 }).success);
    });
});

describe("fees permissions", () => {
    it("are in the registry, staff only, and only discounts are sensitive", () => {
        for (const p of FEES_PERMISSIONS) {
            const reg = PERMISSION_REGISTRY.find(x => x.key === p.key)!;
            assert.ok(reg, p.key);
            assert.deepEqual([...reg.personas], ["STAFF"]);
        }
        assert.deepEqual(FEES_PERMISSIONS.filter(p => "isSensitive" in p && p.isSensitive).map(p => p.key), ["fees.discounts.manage"]);
    });

    it("go to the right roles", () => {
        const granted = (key: string) => ROLE_TEMPLATES.find(r => r.key === key)!.permissions.map(p => p.key);
        assert.ok(granted("bursar").includes("fees.types.manage") && granted("bursar").includes("fees.structures.manage") && granted("bursar").includes("fees.setup.view"));
        assert.ok(!granted("bursar").includes("fees.discounts.manage"));
        assert.ok(granted("principal").includes("fees.setup.view") && !granted("principal").includes("fees.types.manage"));
        for (const key of ["student", "guardian", "teacher"]) assert.ok(!granted(key).some(k => k.startsWith("fees.") && k !== "fees.view"));
    });
});
