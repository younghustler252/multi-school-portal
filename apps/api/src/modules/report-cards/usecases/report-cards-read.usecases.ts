import type { Access } from "../../../foundation/access.service";
import { buildPaginationMeta } from "../../../shared/utils/pagination";
import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import { CARD_INCLUDE, CardWithRefs, snapshotOf } from "../repositories/card-table";
import type { ReportCardBuilder } from "../services/report-card-builder.service";
import { cardsViewWhere, isFamily, mayViewClass, mayWorkOnClass } from "../services/report-card-scope";
import { reportCardErrors } from "../domain/report-cards.errors";
import { isEditableCard, isVisibleCard, nextCardStatus, staleness } from "../domain/report-card.policy";
import { ListCardsQueryType, OverviewQueryType } from "../dtos/report-card.dto";

interface Dependencies { reportCardsRepository: ReportCardsRepository; reportCardBuilder: ReportCardBuilder }

const nameOf = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`.trim();

/** Which cards have gone stale, for the (class, term) pairs on the page. Families never see this. */
async function staleMap(b: ReportCardBuilder, rows: CardWithRefs[]): Promise<Map<string, { stale: boolean; reason: string | null }>> {
    const out = new Map<string, { stale: boolean; reason: string | null }>();
    const prints = new Map<string, string[]>();
    for (const r of rows) {
        const snap = snapshotOf(r);
        if (!snap || !r.classId) { out.set(r.id, { stale: false, reason: null }); continue; }
        const key = `${r.classId}:${r.termId}`;
        if (!prints.has(key)) prints.set(key, await b.currentFingerprint(r.classId, r.termId));
        out.set(r.id, staleness(snap, prints.get(key)!));
    }
    return out;
}

/* ── GET /report-cards: the cards a person may see ── */
export class ListReportCardsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(query: ListCardsQueryType, access: Access) {
        const repo = this.d.reportCardsRepository;
        const termId = query.termId ?? (await repo.currentTerm())?.id;
        if (!termId) return { data: [], meta: buildPaginationMeta(0, query.page, query.limit) };
        const where = { AND: [cardsViewWhere(access), { termId }, ...(query.classId ? [{ classId: query.classId }] : []), ...(query.studentId ? [{ studentId: query.studentId }] : []), ...(query.status ? [{ status: query.status }] : [])] };
        const [total, rows] = await Promise.all([
            repo.cards.count({ where }),
            repo.cards.findMany({ where, include: CARD_INCLUDE, orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }], skip: (query.page - 1) * query.limit, take: query.limit }),
        ]);
        const stale = isFamily(access) ? null : await staleMap(this.d.reportCardBuilder, rows);
        return {
            data: rows.map(r => {
                const snap = snapshotOf(r);
                return {
                    id: r.id, status: r.status, student: { id: r.student.id, name: nameOf(r.student), admissionNumber: r.student.admissionNumber },
                    class: r.class ? { id: r.class.id, name: r.class.name } : null, term: { id: r.term.id, name: r.term.name, session: r.term.session.name },
                    totalScore: r.totalScore, averageScore: r.averageScore, position: r.position, outOf: r.totalStudents,
                    subjects: snap?.result.subjectsCounted ?? 0, missingSubjects: snap?.result.missing.length ?? 0, publishedAt: r.publishedAt,
                    ...(stale ? { stale: stale.get(r.id)!.stale } : {}),
                };
            }),
            meta: buildPaginationMeta(total, query.page, query.limit),
        };
    }
}

/* ── GET /report-cards/:id ── */
export class GetReportCardUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, access: Access) {
        const row = await this.d.reportCardsRepository.cards.findFirst({ where: { AND: [{ id }, cardsViewWhere(access)] }, include: CARD_INCLUDE });
        if (!row) throw reportCardErrors.notFound();
        const snap = snapshotOf(row);
        const family = isFamily(access);
        const base = {
            id: row.id, status: row.status, student: { id: row.student.id, name: nameOf(row.student), admissionNumber: row.student.admissionNumber },
            class: row.class ? { id: row.class.id, name: row.class.name } : null, term: { id: row.term.id, name: row.term.name, session: row.term.session.name },
            teacherRemark: row.teacherRemark, principalRemark: row.principalRemark,
            totalScore: row.totalScore, averageScore: row.averageScore, position: row.position, outOf: row.totalStudents,
            publishedAt: row.publishedAt, generatedAt: row.generatedAt, snapshot: snap,
        };
        if (family) return { ...base, can: { download: isVisibleCard(row.status) } };
        const st = row.classId ? staleness(snap, await this.d.reportCardBuilder.currentFingerprint(row.classId, row.termId)) : { stale: false, reason: null };
        const editable = isEditableCard(row.status);
        return {
            ...base, unpublishReason: row.unpublishReason, stale: st.stale, staleReason: st.reason,
            can: {
                editRemark: editable && mayWorkOnClass(access, row.class?.classTeacherId ?? null),
                editPrincipalRemark: editable && access.can("report_cards.principal_remark"),
                regenerate: editable && mayWorkOnClass(access, row.class?.classTeacherId ?? null),
                publish: access.can("report_cards.publish") && nextCardStatus("publish", row.status) !== null,
                unpublish: access.can("report_cards.publish") && nextCardStatus("unpublish", row.status) !== null,
                download: true,
            },
        };
    }
}

/* ── GET /report-cards/overview?classId&termId: the build and publish screen for one class ── */
export class ClassOverviewUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(query: OverviewQueryType, access: Access) {
        const repo = this.d.reportCardsRepository;
        const termId = query.termId ?? (await repo.currentTerm())?.id;
        if (!termId) throw reportCardErrors.termNotFound();
        const ctx = await this.d.reportCardBuilder.loadClass(query.classId, termId);
        if (!ctx) throw reportCardErrors.classNotFound();
        if (!mayViewClass(access, ctx.cls.classTeacherId)) throw reportCardErrors.cannotSee();

        const cards = await repo.cardsOfStudents(termId, ctx.students.map(s => s.id));
        const by = new Map(cards.map(c => [c.studentId, c]));
        const published = ctx.subjects.filter(s => s.published).length;
        const rows = ctx.students.map(s => {
            const live = ctx.results.get(s.id)!, card = by.get(s.id);
            const st = card ? staleness(snapshotOf(card), ctx.fingerprint) : { stale: false, reason: null };
            return {
                student: { id: s.id, name: nameOf(s), admissionNumber: s.admissionNumber },
                live: { averageScore: live.averageScore, position: live.position, subjects: live.subjectsCounted },
                card: card ? { id: card.id, status: card.status, stale: st.stale, hasTeacherRemark: !!card.teacherRemark, hasPrincipalRemark: !!card.principalRemark } : null,
            };
        });
        return {
            class: { id: ctx.cls.id, name: ctx.cls.name }, term: { id: ctx.term.id, name: ctx.term.name, session: ctx.term.session.name },
            subjects: { published, total: ctx.subjects.length, list: ctx.subjects.map(s => ({ classSubjectId: s.classSubjectId, name: s.subjectName, published: s.published })) },
            students: rows,
            counts: {
                students: rows.length, noCard: rows.filter(r => !r.card).length, draft: rows.filter(r => r.card?.status === "draft").length,
                published: rows.filter(r => r.card && isVisibleCard(r.card.status)).length, stale: rows.filter(r => r.card?.stale).length,
            },
            can: { generate: mayWorkOnClass(access, ctx.cls.classTeacherId), publish: access.can("report_cards.publish") },
        };
    }
}
