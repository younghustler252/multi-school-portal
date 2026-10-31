import type { Access } from "../../../foundation/access.service";
import { AuditService } from "../../audit/services/audit.service";
import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import { CARD_INCLUDE, snapshotOf } from "../repositories/card-table";
import type { ReportCardBuilder } from "../services/report-card-builder.service";
import type { ReportCardNotifier, PublishedCardRef } from "../services/report-card-notifier.service";
import { reportCardErrors } from "../domain/report-cards.errors";
import { nextCardStatus, publishBlockers, staleness } from "../domain/report-card.policy";
import { PublishDtoType, UnpublishDtoType } from "../dtos/report-card.dto";

interface Dependencies { reportCardsRepository: ReportCardsRepository; reportCardBuilder: ReportCardBuilder; reportCardNotifier: ReportCardNotifier; auditService: AuditService }

export interface CardOutcome { id: string; ok: boolean; reason?: string; detail?: string[] }

/*
| PUBLISH report cards (report_cards.publish).
|  - only a DRAFT built from the sheets AS THEY ARE NOW can go out: a card that has gone stale must be generated again first
|  - a card with no scored subject cannot be published; with subjects still unpublished it needs allowMissing
|  - publishing freezes the card (the snapshot never changes again), shows it to the student and guardians, and tells the guardians
|  - one card's problem never stops the others: the answer lists each card
*/
export class PublishReportCardsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: PublishDtoType, schoolId: string, access: Access, actor: { userId: string }, now: Date = new Date()) {
        if (!access.can("report_cards.publish")) throw reportCardErrors.notAllowed("publish report cards");
        const repo = this.d.reportCardsRepository;
        const ids = [...new Set(dto.ids)];
        const rows = await repo.cards.findMany({ where: { id: { in: ids } }, include: CARD_INCLUDE });
        const by = new Map(rows.map(r => [r.id, r]));
        const prints = new Map<string, string[]>();
        const outcomes: CardOutcome[] = []; const out: PublishedCardRef[] = [];

        for (const id of ids) {
            const row = by.get(id);
            if (!row) { outcomes.push({ id, ok: false, reason: "not_found" }); continue; }
            if (nextCardStatus("publish", row.status) === null) { outcomes.push({ id, ok: false, reason: "already_published" }); continue; }
            const snap = snapshotOf(row);
            if (!snap || !row.classId) { outcomes.push({ id, ok: false, reason: "not_generated" }); continue; }
            const key = `${row.classId}:${row.termId}`;
            if (!prints.has(key)) prints.set(key, await this.d.reportCardBuilder.currentFingerprint(row.classId, row.termId));
            const st = staleness(snap, prints.get(key)!);
            if (st.stale) { outcomes.push({ id, ok: false, reason: "stale", detail: [st.reason ?? "The mark sheets changed. Generate this card again"] }); continue; }
            const blockers = publishBlockers(snap, !!dto.allowMissing);
            if (blockers.length) { outcomes.push({ id, ok: false, reason: "blocked", detail: blockers }); continue; }

            const res = await repo.cards.updateMany({ where: { id, status: { in: ["draft", "generated"] } }, data: { status: "published", publishedAt: now, publishedById: actor.userId, unpublishReason: null } });
            if (res.count === 0) { outcomes.push({ id, ok: false, reason: "already_published" }); continue; }
            outcomes.push({ id, ok: true }); out.push({ id, studentId: row.studentId, publishedAt: now, snapshot: snap });
        }

        // Tell the guardians. Publishing has already happened and stays, whatever this does.
        let told = 0, notifyError: string | null = null;
        try {
            const r = await this.d.reportCardNotifier.notifyPublished(schoolId, actor.userId, out);
            told = r.told.length;
            if (r.told.length) await repo.cards.updateMany({ where: { id: { in: r.told }, status: "published" }, data: { status: "sent" } });
        } catch (e) { notifyError = e instanceof Error ? e.message : "could not tell guardians"; console.error("report cards: could not tell guardians:", notifyError); }

        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "report_cards.published", entity: "ReportCard", module: "report_cards",
            newValue: { published: out.length, requested: ids.length, ids: out.slice(0, 100).map(c => c.id), allowMissing: !!dto.allowMissing, guardiansTold: told, notifyError },
        });
        return { published: out.length, guardiansTold: told, notifyError, results: outcomes };
    }
}

/*
| TAKE REPORT CARDS BACK TO DRAFT (report_cards.publish). Needs a reason. Hides them from students and guardians at once and makes the
| remarks editable again. Publishing a rebuilt card later tells the guardians again (a new publication has its own messages).
*/
export class UnpublishReportCardsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: UnpublishDtoType, schoolId: string, access: Access, actor: { userId: string }) {
        if (!access.can("report_cards.publish")) throw reportCardErrors.notAllowed("take report cards back");
        const repo = this.d.reportCardsRepository;
        const ids = [...new Set(dto.ids)];
        const rows = await repo.cards.findMany({ where: { id: { in: ids } }, include: CARD_INCLUDE });
        const by = new Map(rows.map(r => [r.id, r]));
        const results: CardOutcome[] = []; const done: string[] = [];
        for (const id of ids) {
            const row = by.get(id);
            if (!row) { results.push({ id, ok: false, reason: "not_found" }); continue; }
            if (nextCardStatus("unpublish", row.status) === null) { results.push({ id, ok: false, reason: "not_published" }); continue; }
            const res = await repo.cards.updateMany({ where: { id, status: { in: ["published", "sent"] } }, data: { status: "draft", publishedAt: null, publishedById: null, unpublishReason: dto.reason } });
            if (res.count === 0) { results.push({ id, ok: false, reason: "not_published" }); continue; }
            results.push({ id, ok: true }); done.push(id);
        }
        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "report_cards.unpublished", entity: "ReportCard", module: "report_cards",
            newValue: { unpublished: done.length, requested: ids.length, ids: done.slice(0, 100), reason: dto.reason },
        });
        return { unpublished: done.length, results };
    }
}
