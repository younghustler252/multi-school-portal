import { IFeeInvoiceRepository } from "../repositories/fee-invoice.repository";
import { IInvoiceGenerationRepository } from "../repositories/invoice-generation.repository";
import { IFeeStructureRepository } from "../repositories/fee-structure.repository";
import { IFeeTypeRepository } from "../repositories/fee-type.repository";
import { FeeInvoiceMapper } from "../mappers/fee-invoice.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { parseDay } from "../../ledger/domain/ledger.dates";
import { koboOut } from "../../ledger/mappers/kobo";
import { feeErrors } from "../domain/fee.errors";
import { FeeStructureEntity } from "../domain/fee.entity";
import { DiscountInput, EnrolledStudent, FeeInvoiceEntity, NewInvoiceItem } from "../domain/invoice.entity";
import { computeDiscounts, pickStructure, totalsOf } from "../domain/invoice.policy";
import { GenerateInvoicesDtoType, CreateInvoiceDtoType, UpdateDraftInvoiceDtoType } from "../dtos/invoice.dto";

interface Dependencies {
    feeInvoiceRepository: IFeeInvoiceRepository; invoiceGenerationRepository: IInvoiceGenerationRepository;
    feeStructureRepository: IFeeStructureRepository; feeTypeRepository: IFeeTypeRepository;
    feeInvoiceMapper: FeeInvoiceMapper; auditService: AuditService;
}

const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === "P2002";

// Fee lines from what the caller typed: each fee type must exist and be active. The income account is copied now.
async function itemsFromInput(types: IFeeTypeRepository, input: { feeTypeId: string; description?: string; amountKobo: bigint }[]): Promise<NewInvoiceItem[]> {
    const found = new Map((await types.findByIds(input.map(i => i.feeTypeId))).map(t => [t.id, t]));
    return input.map((i, index) => {
        const type = found.get(i.feeTypeId);
        if (!type) throw feeErrors.feeTypeNotFound();
        if (!type.isActive) throw feeErrors.feeTypeInactive(type.name);
        return { feeTypeId: type.id, description: i.description ?? type.name, incomeAccountId: type.incomeAccountId, amountKobo: i.amountKobo, sortOrder: index };
    });
}

// Fee lines from a structure, with the fee type's name and income account as they are today
async function itemsFromStructure(types: IFeeTypeRepository, structure: FeeStructureEntity): Promise<NewInvoiceItem[]> {
    return itemsFromInput(types, structure.items.map(i => ({ feeTypeId: i.feeTypeId, amountKobo: i.amountKobo })));
}

/*
| GENERATE DRAFT INVOICES (brief 8.1). For each active student enrolled in the term (optionally one class, or named students):
| find the best structure (class, new or returning, campus), copy its fees, work out the student's discounts, save a DRAFT.
| Drafts are not in the books and not visible to families until issued. Running it again is safe: a student who already has
| an invoice from a structure is skipped. Students with no matching structure are listed so the bursar can fix the set-up.
*/
export class GenerateInvoicesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: GenerateInvoicesDtoType) {
        const gen = this.d.invoiceGenerationRepository;
        const term = await gen.termInfo(dto.termId);
        if (!term) throw feeErrors.termNotFound();

        const students = await gen.enrolledStudents(dto.termId, { classId: dto.classId, studentIds: dto.studentIds });
        const ids = students.map(s => s.studentId);
        const structures = await this.d.feeStructureRepository.listFiltered({ termId: dto.termId, status: "active" });
        const [earlier, discounts] = await Promise.all([gen.studentsWithEarlierEnrolment(ids, term.startDate), gen.activeDiscounts(ids, term.sessionId)]);

        const byStructure = new Map<string, { structure: FeeStructureEntity; students: EnrolledStudent[] }>();
        const noStructure: EnrolledStudent[] = [];
        for (const s of students) {
            const structure = pickStructure(structures, { classId: s.classId, studentType: earlier.has(s.studentId) ? "RETURNING" : "NEW", branchId: dto.branchId ?? null });
            if (!structure) { noStructure.push(s); continue; }
            const group = byStructure.get(structure.id) ?? { structure, students: [] };
            group.students.push(s);
            byStructure.set(structure.id, group);
        }

        let created = 0, skippedExisting = 0, totalKobo = 0n;
        const invoiceIds: string[] = [];
        for (const { structure, students: group } of byStructure.values()) {
            const items = await itemsFromStructure(this.d.feeTypeRepository, structure);       // stops here if a fee in it was deactivated
            const have = new Set(await this.d.feeInvoiceRepository.liveStudentsForStructure(structure.id, group.map(g => g.studentId)));

            for (const s of group) {
                if (have.has(s.studentId)) { skippedExisting++; continue; }
                const worked = computeDiscounts(items, discounts.get(s.studentId) ?? []);
                try {
                    const draft = await this.d.feeInvoiceRepository.createDraft({
                        type: "TERM_FEES", studentId: s.studentId, sessionId: term.sessionId, termId: term.id, classId: s.classId,
                        branchId: dto.branchId ?? structure.branchId, sourceStructureId: structure.id,
                        dueDate: dto.dueDate ? parseDay(dto.dueDate) : structure.dueDate,
                        ...totalsOf(items, worked.totalKobo), createdById: actorUserId, updatedById: actorUserId,
                    }, items, worked.lines);
                    created++; totalKobo += draft.totalKobo; invoiceIds.push(draft.id);
                } catch (e) {
                    if (isUniqueViolation(e)) { skippedExisting++; continue; }                  // made by someone else a moment ago
                    throw e;
                }
            }
        }

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.invoices.generated", entity: "Term", entityId: dto.termId,
            newValue: { classId: dto.classId ?? null, created, skippedExisting, withoutStructure: noStructure.length, totalKobo: totalKobo.toString() },
        });
        return {
            created, skippedExisting, totalKobo: koboOut(totalKobo), invoiceIds,
            withoutStructure: noStructure.map(s => ({ studentId: s.studentId, name: s.name, admissionNumber: s.admissionNumber, classId: s.classId })),
        };
    }
}

/* ONE DRAFT BY HAND: an admission fee or a one-off charge. Given a term, the student's discounts for that session apply. */
export class CreateInvoiceUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: CreateInvoiceDtoType) {
        const gen = this.d.invoiceGenerationRepository;
        if (!(await gen.studentExists(dto.studentId))) throw feeErrors.studentNotFound();
        const term = dto.termId ? await gen.termInfo(dto.termId) : null;
        if (dto.termId && !term) throw feeErrors.termNotFound();

        const items = await itemsFromInput(this.d.feeTypeRepository, dto.items);
        const rules = term ? (await gen.activeDiscounts([dto.studentId], term.sessionId)).get(dto.studentId) ?? [] : [];
        const worked = computeDiscounts(items, rules);

        const draft = await this.d.feeInvoiceRepository.createDraft({
            type: dto.type, studentId: dto.studentId, sessionId: term?.sessionId ?? null, termId: term?.id ?? null, branchId: dto.branchId ?? null,
            dueDate: dto.dueDate ? parseDay(dto.dueDate) : null, note: dto.note ?? null,
            ...totalsOf(items, worked.totalKobo), createdById: actorUserId, updatedById: actorUserId,
        }, items, worked.lines);

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.invoice.created", entity: "FeeInvoice", entityId: draft.id,
            newValue: { studentId: draft.studentId, type: draft.type, totalKobo: draft.totalKobo.toString() },
        });
        return this.d.feeInvoiceMapper.toResponse(draft);
    }
}

async function loadDraft(repo: IFeeInvoiceRepository, id: string): Promise<FeeInvoiceEntity> {
    const inv = await repo.findById(id);
    if (!inv) throw feeErrors.invoiceNotFound();
    if (inv.status !== "draft") throw feeErrors.invoiceNotDraft(inv.invoiceNumber);
    return inv;
}

/* EDIT A DRAFT: due date, note, or the fee lines (replaced as a whole, discounts worked out again). */
export class UpdateDraftInvoiceUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: UpdateDraftInvoiceDtoType) {
        const repo = this.d.feeInvoiceRepository;
        const inv = await loadDraft(repo, id);
        if (dto.version !== undefined && dto.version !== inv.version) throw feeErrors.invoiceChanged();

        let items: NewInvoiceItem[] = inv.items.map(i => ({ feeTypeId: i.feeTypeId, description: i.description, incomeAccountId: i.incomeAccountId, amountKobo: i.amountKobo, sortOrder: i.sortOrder }));
        let discounts = inv.discounts.map(x => ({ ruleId: x.ruleId, feeTypeId: x.feeTypeId, label: x.label, amountKobo: x.amountKobo }));
        let totals = totalsOf(items, inv.discountKobo);

        if (dto.items) {
            items = await itemsFromInput(this.d.feeTypeRepository, dto.items);
            const rules: DiscountInput[] = inv.sessionId ? (await this.d.invoiceGenerationRepository.activeDiscounts([inv.studentId], inv.sessionId)).get(inv.studentId) ?? [] : [];
            const worked = computeDiscounts(items, rules);
            discounts = worked.lines;
            totals = totalsOf(items, worked.totalKobo);
        }

        const saved = await repo.replaceDraft(id, inv.version, {
            ...totals, updatedById: actorUserId,
            ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? parseDay(dto.dueDate) : null }),
            ...(dto.note !== undefined && { note: dto.note }),
        }, items, discounts);
        if (!saved) throw feeErrors.invoiceChanged();

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.invoice.updated", entity: "FeeInvoice", entityId: id,
            oldValue: { totalKobo: inv.totalKobo.toString(), dueDate: inv.dueDate, note: inv.note },
            newValue: { totalKobo: saved.totalKobo.toString(), dueDate: saved.dueDate, note: saved.note },
        });
        return this.d.feeInvoiceMapper.toResponse(saved);
    }
}

/* DELETE A DRAFT: it never reached the books, so it can simply go. */
export class DeleteDraftInvoiceUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string) {
        const inv = await loadDraft(this.d.feeInvoiceRepository, id);
        if (!(await this.d.feeInvoiceRepository.deleteDraft(id))) throw feeErrors.invoiceChanged();   // issued by someone else meanwhile
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "fees.invoice.draft_deleted", entity: "FeeInvoice", entityId: id,
            oldValue: { studentId: inv.studentId, totalKobo: inv.totalKobo.toString() },
        });
    }
}
