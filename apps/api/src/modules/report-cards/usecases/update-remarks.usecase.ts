import type { Access } from "../../../foundation/access.service";
import { AuditService } from "../../audit/services/audit.service";
import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import { CARD_INCLUDE } from "../repositories/card-table";
import { cardsViewWhere, mayWorkOnClass } from "../services/report-card-scope";
import { reportCardErrors } from "../domain/report-cards.errors";
import { isEditableCard } from "../domain/report-card.policy";
import { RemarksDtoType } from "../dtos/report-card.dto";

interface Dependencies { reportCardsRepository: ReportCardsRepository; auditService: AuditService }

const clean = (v: string | null | undefined): string | null | undefined => v === undefined ? undefined : (v === null || v.trim() === "" ? null : v.trim());

/*
| WRITE THE REMARKS on a DRAFT card.
|  - teacher remark: the class teacher of that class, or an administrator (report_cards.generate)
|  - principal remark: report_cards.principal_remark
|  - a published card cannot be changed: take it back to draft first (that is audited)
*/
export class UpdateRemarksUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, dto: RemarksDtoType, schoolId: string, access: Access, actor: { userId: string }) {
        const repo = this.d.reportCardsRepository;
        const card = await repo.cards.findFirst({ where: { AND: [{ id }, cardsViewWhere(access)] }, include: CARD_INCLUDE });
        if (!card) throw reportCardErrors.notFound();
        if (!isEditableCard(card.status)) throw reportCardErrors.notEditable(card.status);

        const teacher = clean(dto.teacherRemark), principal = clean(dto.principalRemark);
        if (teacher !== undefined && !mayWorkOnClass(access, card.class?.classTeacherId ?? null)) throw reportCardErrors.notYourClass();
        if (principal !== undefined && !access.can("report_cards.principal_remark")) throw reportCardErrors.notAllowed("write the principal's remark");

        const data: Record<string, unknown> = {};
        if (teacher !== undefined) data.teacherRemark = teacher;
        if (principal !== undefined) data.principalRemark = principal;
        const res = await repo.cards.updateMany({ where: { id, status: { in: ["draft", "generated"] } }, data });
        if (res.count === 0) throw reportCardErrors.notEditable("published");

        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "report_cards.remarks_saved", entity: "ReportCard", entityId: id, module: "report_cards",
            oldValue: { teacherRemark: card.teacherRemark, principalRemark: card.principalRemark }, newValue: data,
        });
        return { id, teacherRemark: teacher === undefined ? card.teacherRemark : teacher, principalRemark: principal === undefined ? card.principalRemark : principal };
    }
}
