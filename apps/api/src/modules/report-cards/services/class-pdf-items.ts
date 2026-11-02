import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import { snapshotOf } from "../repositories/card-table";
import { CardSnapshot, isVisibleCard } from "../domain/report-card.policy";
import { reportCardErrors } from "../domain/report-cards.errors";

export interface ClassPdfClass { id: string; name: string; classTeacherId: string | null }
export interface ClassPdfItem { snap: CardSnapshot; remarks: { teacherRemark: string | null; principalRemark: string | null }; draft: boolean }

/**
 * Every card of a class that has content to print, for a whole-class PDF. Shared by the use case (which checks
 * access first) and the background worker (trusted system context, no access check). Throws classNotFound /
 * nothingPublished — never returns an empty, useless result.
 */
export async function loadClassPdfItems(
    repo: ReportCardsRepository, termId: string, classId: string, include: "published" | "all",
): Promise<{ cls: ClassPdfClass; items: ClassPdfItem[] }> {
    const cls = await repo.classOf(classId);
    if (!cls) throw reportCardErrors.classNotFound();

    const list = await repo.studentsOnList(classId, termId);
    const cards = await repo.cardsOfStudents(termId, list.map(e => e.studentId));
    const withContent = cards
        .filter(c => snapshotOf(c) !== null)
        .filter(c => include === "all" ? true : isVisibleCard(c.status))
        .sort((a, b) => `${a.student.lastName}${a.student.firstName}`.localeCompare(`${b.student.lastName}${b.student.firstName}`));
    if (withContent.length === 0) throw reportCardErrors.nothingPublished();

    const items = withContent.map(c => ({
        snap: snapshotOf(c)!,
        remarks: { teacherRemark: c.teacherRemark, principalRemark: c.principalRemark },
        draft: !isVisibleCard(c.status),
    }));
    return { cls, items };
}
