import type { Access } from "../../../foundation/access.service";
import { AuditService } from "../../audit/services/audit.service";
import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import type { ReportCardBuilder } from "../services/report-card-builder.service";
import { mayWorkOnClass } from "../services/report-card-scope";
import { reportCardErrors } from "../domain/report-cards.errors";
import { isEditableCard } from "../domain/report-card.policy";
import { GenerateDtoType } from "../dtos/report-card.dto";

interface Dependencies { reportCardsRepository: ReportCardsRepository; reportCardBuilder: ReportCardBuilder; auditService: AuditService }

export type SkipReason = "not_on_class_list" | "already_published";

/*
| GENERATE (or rebuild) DRAFT REPORT CARDS for a class and term. Reads PUBLISHED mark sheets only.
|  - everyone on the class list is ranked, so the overall position is the real position in the class
|  - a draft that already exists is rebuilt from the sheets as they are now, and KEEPS its remarks
|  - a card that is already published is never touched here (take it back to draft first)
|  - subjects whose sheet is not published yet show as "missing", they are not counted as 0
|  - the class teacher (ASSIGNED) or an administrator (ALL) may do this
*/
export class GenerateReportCardsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: GenerateDtoType, schoolId: string, access: Access, actor: { userId: string }, now: Date = new Date()) {
        const repo = this.d.reportCardsRepository;
        const termId = dto.termId ?? (await repo.currentTerm())?.id;
        if (!termId) throw reportCardErrors.termNotFound();
        const ctx = await this.d.reportCardBuilder.loadClass(dto.classId, termId);
        if (!ctx) throw reportCardErrors.classNotFound();
        if (!mayWorkOnClass(access, ctx.cls.classTeacherId)) throw reportCardErrors.notYourClass();
        if (!ctx.subjects.some(s => s.published)) throw reportCardErrors.nothingPublished();

        const onList = new Set(ctx.students.map(s => s.id));
        const wanted = dto.studentIds ? [...new Set(dto.studentIds)] : ctx.students.map(s => s.id);
        const skipped: Array<{ studentId: string; reason: SkipReason }> = wanted.filter(id => !onList.has(id)).map(id => ({ studentId: id, reason: "not_on_class_list" }));
        const targets = wanted.filter(id => onList.has(id));

        const [existing, attendance] = await Promise.all([repo.cardsOfStudents(termId, targets), repo.attendanceByStudent(termId, targets)]);
        const by = new Map(existing.map(c => [c.studentId, c]));
        let created = 0, updated = 0;

        await repo.inTransaction(async table => {
            for (const studentId of targets) {
                const card = by.get(studentId);
                if (card && !isEditableCard(card.status)) { skipped.push({ studentId, reason: "already_published" }); continue; }
                const r = ctx.results.get(studentId)!;
                const data = {
                    classId: ctx.cls.id, snapshot: this.d.reportCardBuilder.snapshotFor(ctx, studentId, attendance.get(studentId) ?? [], now) as unknown,
                    totalScore: r.totalScore, averageScore: r.averageScore, position: r.position, totalStudents: r.outOf || null,
                    status: "draft", generatedAt: now, generatedById: actor.userId,
                };
                if (card) { await table.update({ where: { id: card.id }, data }); updated++; }
                else { await table.create({ data: { ...data, studentId, termId } }); created++; }
            }
        });

        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "report_cards.generated", entity: "ReportCard", module: "report_cards",
            newValue: { classId: ctx.cls.id, termId, created, updated, skipped: skipped.length, subjectsPublished: ctx.subjects.filter(s => s.published).length, subjectsTotal: ctx.subjects.length },
        });
        return {
            classId: ctx.cls.id, termId, created, updated, skipped,
            subjects: { published: ctx.subjects.filter(s => s.published).length, total: ctx.subjects.length, missing: ctx.subjects.filter(s => !s.published).map(s => s.subjectName) },
        };
    }
}
