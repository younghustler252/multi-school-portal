import { IFinancePeriodRepository } from "../repositories/finance-period.repository";
import { IPeriodCloseRepository } from "../repositories/period-close.repository";
import { FinancePeriodMapper } from "../mappers/finance-period.mapper";
import { RunLedgerIntegrityCheckUseCase } from "./ledger-integrity.usecases";
import { AuditService } from "../../audit/services/audit.service";
import { CloseChecklist, buildChecklist } from "../domain/period-close";
import { FinancePeriodEntity } from "../domain/ledger.entity";
import { ledgerErrors } from "../domain/ledger.errors";
import { dayString, todayInFinanceZone } from "../domain/ledger.dates";
import { ClosePeriodDtoType, ReopenPeriodDtoType } from "../dtos/ledger.dto";
import { FinanceSettingsReader, settingsOf } from "../../finance-settings/domain/finance-settings";

interface Dependencies {
    financePeriodRepository: IFinancePeriodRepository; periodCloseRepository: IPeriodCloseRepository; financePeriodMapper: FinancePeriodMapper;
    runLedgerIntegrityCheckUseCase: RunLedgerIntegrityCheckUseCase; auditService: AuditService;
    financeSettingsService?: FinanceSettingsReader;      // finance.reconciliation_blocks_close; absent in hand-built tests (default: only a warning)
}
interface Options { now?: () => Date }

async function loadPeriod(d: Dependencies, id: string): Promise<FinancePeriodEntity> {
    const p = await d.financePeriodRepository.findById(id);
    if (!p) throw ledgerErrors.periodNotFound();
    return p;
}

async function checklistFor(d: Dependencies, p: FinancePeriodEntity): Promise<CloseChecklist> {
    const counts = await d.periodCloseRepository.counts(dayString(p.startDate), dayString(p.endDate));
    const settings = await settingsOf(d);
    return buildChecklist(counts, await d.runLedgerIntegrityCheckUseCase.execute(), { reconciliationBlocksClose: settings.reconciliationBlocksClose });
}

/* The checklist for one month, so the bursar sees what stands in the way before pressing close. Read-only. */
export class GetCloseChecklistUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(periodId: string) {
        const p = await loadPeriod(this.d, periodId);
        return { period: this.d.financePeriodMapper.toResponse(p), checklist: await checklistFor(this.d, p) };
    }
}

/*
| CLOSE a month. It must have ended, be open, and have no blockers. Open items (warnings) need the person to say they know.
| After this the posting service refuses any entry dated inside the month, and a report for the month cannot change.
*/
export class ClosePeriodUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(periodId: string, schoolId: string, actorUserId: string, dto: ClosePeriodDtoType) {
        const d = this.d;
        const p = await loadPeriod(d, periodId);
        if (p.status === "CLOSED") throw ledgerErrors.periodAlreadyClosed(p.name);

        const today = todayInFinanceZone(this.now());
        const end = dayString(p.endDate);
        if (end >= today) throw ledgerErrors.periodNotEnded(p.name, end, today);

        const checklist = await checklistFor(d, p);
        const open = checklist.items.filter(i => i.severity !== "ok");
        if (!checklist.canClose) throw ledgerErrors.closeBlocked(p.name, open.filter(i => i.severity === "blocker"));
        if (checklist.needsAcknowledgement && !dto.acknowledgeWarnings) throw ledgerErrors.closeNeedsAcknowledgement(p.name, open);

        if (!(await d.financePeriodRepository.close(periodId, actorUserId, this.now()))) throw ledgerErrors.periodChanged();
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.period.closed", entity: "FinancePeriod", entityId: periodId,
            oldValue: { status: "OPEN" }, newValue: { status: "CLOSED", period: p.name, note: dto.note ?? null, acknowledged: open.map(i => ({ key: i.key, count: i.count })) },
        });
        return { period: d.financePeriodMapper.toResponse(await loadPeriod(d, periodId)), checklist };
    }
}

/* REOPEN a closed month: only with a written reason, and the audit trail keeps who, when and why. */
export class ReopenPeriodUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(periodId: string, schoolId: string, actorUserId: string, dto: ReopenPeriodDtoType) {
        const d = this.d;
        const reason = dto.reason.trim();
        if (!reason) throw ledgerErrors.reopenReasonRequired();
        const p = await loadPeriod(d, periodId);
        if (p.status !== "CLOSED") throw ledgerErrors.periodNotClosed(p.name);

        if (!(await d.financePeriodRepository.reopen(periodId, actorUserId, reason, this.now()))) throw ledgerErrors.periodChanged();
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.period.reopened", entity: "FinancePeriod", entityId: periodId,
            oldValue: { status: "CLOSED" }, newValue: { status: "OPEN", period: p.name, reason },
        });
        return d.financePeriodMapper.toResponse(await loadPeriod(d, periodId));
    }
}
