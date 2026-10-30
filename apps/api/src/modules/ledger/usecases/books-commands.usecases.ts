import { randomUUID } from "crypto";
import { PostingService } from "../services/posting.service";
import { ILedgerAccountRepository } from "../repositories/ledger-account.repository";
import { IJournalRepository } from "../repositories/journal.repository";
import { JournalMapper } from "../mappers/journal.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { ledgerErrors } from "../domain/ledger.errors";
import { LedgerAccountEntity } from "../domain/ledger.entity";
import { OpeningBalanceDtoType, TransferDtoType } from "../dtos/ledger.dto";
import { koboOut } from "../mappers/kobo";

interface Dependencies {
    postingService: PostingService; ledgerAccountRepository: ILedgerAccountRepository; journalRepository: IJournalRepository;
    journalMapper: JournalMapper; auditService: AuditService;
}

async function activeAccounts(repo: ILedgerAccountRepository, ids: string[]): Promise<Map<string, LedgerAccountEntity>> {
    const map = new Map((await repo.findByIds(ids)).map(a => [a.id, a]));
    for (const id of ids) {
        const a = map.get(id);
        if (!a || !a.isActive) throw ledgerErrors.accountNotFound(id);
    }
    return map;
}

/*
| OPENING BALANCE (brief rule 14): what a money account held before the school started using the system.
| Debit the account and credit Opening balance equity (reversed for an overdraft). Once per account: to correct it,
| reverse the journal and enter it again (the new entry gets a new idempotency key, because the old one is spent).
*/
export class SetOpeningBalanceUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: OpeningBalanceDtoType) {
        if (dto.amountKobo === 0n) throw ledgerErrors.amountInvalid();
        const account = (await activeAccounts(this.d.ledgerAccountRepository, [dto.accountId])).get(dto.accountId)!;
        if (!account.isMoneyAccount) throw ledgerErrors.notMoneyAccount(account.name);

        const earlier = await this.d.journalRepository.statusesBySource("OPENING_BALANCE", account.id);
        if (earlier.includes("POSTED")) throw ledgerErrors.openingAlreadySet(account.name);

        const amount = dto.amountKobo < 0n ? -dto.amountKobo : dto.amountKobo;
        const money = dto.amountKobo > 0n ? { debitKobo: amount } : { creditKobo: amount };
        const equity = dto.amountKobo > 0n ? { creditKobo: amount } : { debitKobo: amount };

        const r = await this.d.postingService.post({
            entryDate: dto.asOfDate, description: `Opening balance: ${account.name}`,
            sourceType: "OPENING_BALANCE", sourceId: account.id, purpose: `OPENING:${earlier.length + 1}`,
            lines: [{ accountId: account.id, ...money }, { systemKey: "OPENING_EQUITY", ...equity }], actorUserId,
        });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "finance.opening_balance.set", entity: "LedgerAccount", entityId: account.id,
            newValue: { amountKobo: koboOut(dto.amountKobo), asOfDate: dto.asOfDate, journalNumber: r.journal.number },
        });
        return { journal: this.d.journalMapper.toSummary(r.journal), duplicate: r.duplicate };
    }
}

/* TRANSFER (brief rule 11): money moving between two money accounts. Debit the destination, credit the source. */
export class RecordTransferUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, actorUserId: string, dto: TransferDtoType) {
        if (dto.fromAccountId === dto.toAccountId) throw ledgerErrors.sameAccount();
        const accounts = await activeAccounts(this.d.ledgerAccountRepository, [dto.fromAccountId, dto.toAccountId]);
        const from = accounts.get(dto.fromAccountId)!, to = accounts.get(dto.toAccountId)!;
        for (const a of [from, to]) if (!a.isMoneyAccount) throw ledgerErrors.notMoneyAccount(a.name);

        const r = await this.d.postingService.post({
            entryDate: dto.entryDate, description: dto.description?.trim() || `Transfer from ${from.name} to ${to.name}`,
            sourceType: "TRANSFER", sourceId: dto.requestId ?? randomUUID(), purpose: "TRANSFER",
            lines: [{ accountId: to.id, debitKobo: dto.amountKobo }, { accountId: from.id, creditKobo: dto.amountKobo }], actorUserId,
        });
        if (!r.duplicate) {
            await this.d.auditService.log({
                userId: actorUserId, schoolId, action: "finance.transfer.recorded", entity: "JournalEntry", entityId: r.journal.id,
                newValue: { from: from.name, to: to.name, amountKobo: koboOut(dto.amountKobo), entryDate: dto.entryDate, journalNumber: r.journal.number },
            });
        }
        return { journal: this.d.journalMapper.toSummary(r.journal), duplicate: r.duplicate };
    }
}
