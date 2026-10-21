import { randomUUID } from "crypto";
import { PostingService } from "../services/posting.service";
import { ILedgerAccountRepository } from "../repositories/ledger-account.repository";
import { JournalMapper } from "../mappers/journal.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { ledgerErrors } from "../domain/ledger.errors";
import { isControlAccount } from "../domain/ledger.policy";
import { ManualJournalDtoType, ReverseJournalDtoType } from "../dtos/ledger.dto";
import { koboOut } from "../mappers/kobo";

interface Dependencies {
    postingService: PostingService; ledgerAccountRepository: ILedgerAccountRepository;
    journalMapper: JournalMapper; auditService: AuditService;
}

/*
| MANUAL JOURNAL (an accountant's free journal, brief rule 16): a written reason, balanced lines, an open period.
| It may not touch accounts the system keeps in step with invoices, bills and payroll (they have sub-ledgers, and the
| nightly control check would break). Always audited. Sending the same requestId twice posts once.
*/
export class PostManualJournalUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: ManualJournalDtoType) {
        const ids = [...new Set(dto.lines.map(l => l.accountId))];
        const accounts = new Map((await this.d.ledgerAccountRepository.findByIds(ids)).map(a => [a.id, a]));
        for (const id of ids) {
            const a = accounts.get(id);
            if (!a || !a.isActive) throw ledgerErrors.accountNotFound(id);
            if (isControlAccount(a.systemKey)) throw ledgerErrors.accountLocked(a.name);
        }

        const description = `${dto.description.trim()} (${dto.reason.trim()})`;
        const r = await this.d.postingService.post({
            entryDate: dto.entryDate, description, sourceType: "MANUAL", sourceId: dto.requestId ?? randomUUID(), purpose: "MANUAL",
            lines: dto.lines.map(l => ({ accountId: l.accountId, debitKobo: l.debitKobo, creditKobo: l.creditKobo })),
            actorUserId,
        });

        if (!r.duplicate) {
            await this.d.auditService.log({
                userId: actorUserId, schoolId, action: "finance.journal.manual_posted", entity: "JournalEntry", entityId: r.journal.id,
                newValue: { number: r.journal.number, entryDate: dto.entryDate, totalKobo: koboOut(r.journal.totalKobo), description }, metadata: { reason: dto.reason },
            });
        }
        return { journal: this.d.journalMapper.toSummary(r.journal), duplicate: r.duplicate };
    }
}

export class ReverseJournalUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: ReverseJournalDtoType) {
        const r = await this.d.postingService.reverse(id, { reason: dto.reason, entryDate: dto.entryDate, actorUserId });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.journal.reversed", entity: "JournalEntry", entityId: r.original.id,
            oldValue: { number: r.original.number, status: "POSTED" },
            newValue: { reversalId: r.journal.id, reversalNumber: r.journal.number, entryDate: dto.entryDate ?? null }, metadata: { reason: dto.reason },
        });
        return { journal: this.d.journalMapper.toSummary(r.journal), duplicate: false };
    }
}
