import { randomUUID } from "crypto";
import { ISettlementRepository } from "../repositories/settlement.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { AuditService } from "../../audit/services/audit.service";
import { SettlementMapper } from "../mappers/settlement.mapper";
import { OnlinePaymentFacts } from "../domain/settlement.entity";
import { MatchedItem, SettlementGroup, matchSettlements, parseSettlementCsv } from "../domain/settlement-report";
import { settlementErrors } from "../domain/settlement.errors";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { koboOut } from "../../ledger/mappers/kobo";
import { PageQueryType, ReverseSettlementDtoType, SettlePaymentsDtoType, SettlementReportDtoType } from "../dtos/settlement.dto";

interface Dependencies {
    settlementRepository: ISettlementRepository; ledgerAccountRepository: ILedgerAccountRepository; postingService: PostingService;
    settlementMapper: SettlementMapper; auditService: AuditService;
}
interface Options { now?: () => Date; transaction?: <T>(fn: () => Promise<T>) => Promise<T> }

export const PROVIDER = "paystack";
export const MAX_REPORT_ROWS = 5000;

// Loaded on first use so that importing this file never needs a database connection
const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

async function bankAccountFor(d: Dependencies, accountId?: string) {
    const repo = d.ledgerAccountRepository;
    const bank = accountId ? await repo.findById(accountId) : (await repo.findPostable([], ["BANK_DEFAULT"]))[0];
    if (!bank || !bank.isActive) throw settlementErrors.accountInvalid("The bank account does not exist or is not active");
    if (!bank.isMoneyAccount || bank.subtype === "ONLINE_CLEARING") throw settlementErrors.accountInvalid("A settlement must land in a bank or other money account");
    return bank;
}

/*
| Records ONE settlement: Dr bank (net), Dr bank charges (fee), Cr online payments clearing (gross), and marks the payments paid out.
| The journal and the claim on the payments are saved together. The same gateway reference never posts twice, and a payment is
| in at most one live settlement (the database holds that line too).
*/
async function recordOne(d: Dependencies, run: <T>(fn: () => Promise<T>) => Promise<T>, today: string, schoolId: string, actor: string, s: {
    reference: string; settledOn: string; items: MatchedItem[]; accountId: string; note: string | null;
}) {
    parseDay(s.settledOn);
    if (s.settledOn > today) throw settlementErrors.accountInvalid(`A settlement cannot be dated in the future (${s.settledOn})`);
    if (await d.settlementRepository.findByReference(PROVIDER, s.reference)) throw settlementErrors.duplicate(s.reference);

    const gross = s.items.reduce((x, i) => x + i.amountKobo, 0n), fee = s.items.reduce((x, i) => x + i.feeKobo, 0n);
    if (fee < 0n || fee >= gross) throw settlementErrors.feeInvalid();
    const net = gross - fee;
    const lines = [{ accountId: s.accountId, debitKobo: net }] as any[];
    if (fee > 0n) lines.push({ systemKey: "BANK_CHARGES", debitKobo: fee });
    lines.push({ systemKey: "ONLINE_CLEARING", creditKobo: gross });

    const id = randomUUID();
    const journal = await run(async () => {
        const posted = await d.postingService.post({
            entryDate: s.settledOn, description: `Online payments settled (${s.reference})${s.note ? `: ${s.note}` : ""}`,
            sourceType: "TRANSFER", sourceId: s.reference, purpose: "SETTLE", lines, actorUserId: actor,
        });
        if (posted.duplicate) throw settlementErrors.duplicate(s.reference);       // a lump settlement with this reference was recorded by hand
        const ok = await d.settlementRepository.insert(
            { id, provider: PROVIDER, reference: s.reference, settledOn: s.settledOn, grossKobo: gross, feeKobo: fee, netKobo: net, accountId: s.accountId, journalId: posted.journal.id, note: s.note, recordedById: actor },
            s.items.map(i => ({ id: randomUUID(), paymentId: i.paymentId, amountKobo: i.amountKobo, feeKobo: i.feeKobo })));
        if (!ok) throw settlementErrors.paymentsInvalid(s.items.map(i => ({ paymentId: i.paymentId, message: "Already settled by another settlement" })));
        return posted.journal;
    });
    await d.auditService.log({
        userId: actor, schoolId, action: "payments.online.settled", entity: "GatewaySettlement", entityId: id,
        newValue: { reference: s.reference, grossKobo: gross.toString(), feeKobo: fee.toString(), netKobo: net.toString(), payments: s.items.length, settledOn: s.settledOn, accountId: s.accountId, journalNumber: journal.number },
    });
    return { id, reference: s.reference, journalId: journal.id, journalNumber: journal.number, payments: s.items.length, grossKobo: koboOut(gross), feeKobo: koboOut(fee), netKobo: koboOut(net) };
}

/* Reads the report and matches it; shared by the preview and the record. */
async function readReport(d: Dependencies, dto: SettlementReportDtoType) {
    const parsed = parseSettlementCsv(dto.csv, dto.settlementReference);
    if (parsed.missingColumns.length) throw settlementErrors.reportColumns(parsed.missingColumns);
    if (parsed.rows.length === 0) throw settlementErrors.reportEmpty();
    if (parsed.rows.length > MAX_REPORT_ROWS) throw settlementErrors.tooLarge(MAX_REPORT_ROWS, parsed.rows.length);
    if (parsed.problems.length > 0 && !dto.skipUnreadableRows) throw settlementErrors.reportUnreadable(parsed.problems);
    const payments = await d.settlementRepository.findPaymentsByReferences(parsed.rows.map(r => r.reference));
    return { parsed, groups: matchSettlements(parsed.rows, payments) };
}

/* PREVIEW a gateway report: for each settlement, what matched, what did not and why. Changes nothing. */
export class PreviewSettlementReportUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: SettlementReportDtoType) {
        const { parsed, groups } = await readReport(this.d, dto);
        const out = [];
        for (const g of groups) {
            const existing = await this.d.settlementRepository.findByReference(PROVIDER, g.settlementRef);
            out.push({ ...this.d.settlementMapper.group(g), alreadyRecorded: existing !== null, canRecord: g.clean && existing === null && !!(g.settledOn ?? dto.settledOn) });
        }
        return { settlements: out, unreadableRows: parsed.problems.slice(0, 20), unreadableRowCount: parsed.problems.length };
    }
}

/*
| RECORD every clean settlement in a gateway report. A settlement with a problem (unknown reference, a different amount, already settled...)
| is skipped and reported, never half recorded. One transaction per settlement, so one failure never undoes the others.
*/
export class RecordSettlementReportUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.now = options.now ?? (() => new Date()); this.transaction = options.transaction ?? defaultTransaction; }

    async execute(schoolId: string, actorUserId: string, dto: SettlementReportDtoType) {
        const d = this.d;
        const bank = await bankAccountFor(d, dto.accountId);
        const { parsed, groups } = await readReport(d, dto);
        const today = todayInFinanceZone(this.now());

        const recorded: Awaited<ReturnType<typeof recordOne>>[] = [], skipped: { settlementRef: string; reason: string; code: string }[] = [];
        for (const g of groups) {
            const settledOn = g.settledOn ?? dto.settledOn;
            if (!g.clean) { skipped.push({ settlementRef: g.settlementRef, code: "SETTLEMENT_NOT_CLEAN", reason: `${g.problems.length} transaction(s) could not be matched` }); continue; }
            if (!settledOn) { skipped.push({ settlementRef: g.settlementRef, code: "SETTLEMENT_DATE_REQUIRED", reason: "No settlement date in the report; send settledOn" }); continue; }
            try {
                recorded.push(await recordOne(d, this.transaction, today, schoolId, actorUserId, { reference: g.settlementRef, settledOn, items: g.items, accountId: bank.id, note: dto.note ?? null }));
            } catch (e: any) {
                if (e?.code === "SETTLEMENT_ALREADY_RECORDED" || e?.code === "SETTLEMENT_PAYMENTS_INVALID") skipped.push({ settlementRef: g.settlementRef, code: e.code, reason: e.message });
                else throw e;
            }
        }
        return { recorded, skipped, unreadableRowCount: parsed.problems.length };
    }
}

/* SETTLE chosen payments by hand: the school says which online payments the gateway paid out and what it kept. */
export class SettlePaymentsUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.now = options.now ?? (() => new Date()); this.transaction = options.transaction ?? defaultTransaction; }

    async execute(schoolId: string, actorUserId: string, dto: SettlePaymentsDtoType) {
        const d = this.d, today = todayInFinanceZone(this.now());
        const bank = await bankAccountFor(d, dto.accountId);
        const found = new Map((await d.settlementRepository.findPaymentsByIds(dto.paymentIds)).map(p => [p.id, p]));
        const reasons: { paymentId: string; message: string }[] = [];
        const items: MatchedItem[] = [];
        for (const pid of dto.paymentIds) {
            const p: OnlinePaymentFacts | undefined = found.get(pid);
            if (!p) reasons.push({ paymentId: pid, message: "Not an online payment" });
            else if (p.reversed) reasons.push({ paymentId: pid, message: "This payment was reversed" });
            else if (p.status !== "CONFIRMED") reasons.push({ paymentId: pid, message: "This payment is not confirmed" });
            else if (p.settled) reasons.push({ paymentId: pid, message: "This payment was already settled" });
            else items.push({ paymentId: p.id, reference: p.reference ?? p.id, amountKobo: p.amountKobo, feeKobo: 0n, payerName: p.payerName });
        }
        if (reasons.length) throw settlementErrors.paymentsInvalid(reasons);
        // The gateway's fee is one figure for the whole payout; it is shared out by amount (the last payment takes the rounding)
        const gross = items.reduce((x, i) => x + i.amountKobo, 0n);
        if (dto.feeKobo >= gross) throw settlementErrors.feeInvalid();
        let left = dto.feeKobo;
        items.forEach((i, k) => { const share = k === items.length - 1 ? left : (dto.feeKobo * i.amountKobo) / gross; i.feeKobo = share; left -= share; });

        return recordOne(d, this.transaction, today, schoolId, actorUserId, { reference: dto.reference, settledOn: dto.settledOn ?? today, items, accountId: bank.id, note: dto.note ?? null });
    }
}

/* Confirmed online payments the gateway has not paid out yet, and the control: the clearing account should hold exactly that. */
export class ListUnsettledUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: PageQueryType) {
        const r = await this.d.settlementRepository.listUnsettled(q.page, q.limit);
        const clearing = await this.d.settlementRepository.clearingBalance();
        return {
            data: r.rows.map(p => this.d.settlementMapper.payment(p)),
            meta: { page: q.page, limit: q.limit, total: r.total },
            unsettledKobo: koboOut(r.totalKobo), clearingBalanceKobo: koboOut(clearing), differenceKobo: koboOut(clearing - r.totalKobo),
        };
    }
}

export class ListSettlementsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: PageQueryType) {
        const r = await this.d.settlementRepository.list(q.page, q.limit);
        return { data: r.rows.map(s => this.d.settlementMapper.settlement(s)), meta: { page: q.page, limit: q.limit, total: r.total } };
    }
}

export class GetSettlementUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) {
        const r = await this.d.settlementRepository.findById(id);
        if (!r) throw settlementErrors.notFound();
        return { ...this.d.settlementMapper.settlement(r.settlement), payments: r.items.map(i => this.d.settlementMapper.item(i)) };
    }
}

/* REVERSE a settlement recorded wrongly: the journal is reversed through the posting service and its payments become unsettled again. */
export class ReverseSettlementUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(id: string, schoolId: string, actorUserId: string, dto: ReverseSettlementDtoType) {
        const d = this.d, reason = dto.reason.trim();
        const found = await d.settlementRepository.findById(id);
        if (!found) throw settlementErrors.notFound();
        if (found.settlement.reversedAt) throw settlementErrors.alreadyReversed();

        await this.transaction(async () => {
            await d.postingService.reverse(found.settlement.journalId, { reason, actorUserId });
            if (!(await d.settlementRepository.markReversed(id, actorUserId, reason))) throw settlementErrors.alreadyReversed();
            await d.settlementRepository.releaseItems(id);
        });
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payments.online.settlement_reversed", entity: "GatewaySettlement", entityId: id,
            oldValue: { reference: found.settlement.reference, grossKobo: found.settlement.grossKobo.toString() }, newValue: { reason },
        });
        return { reversed: true, reference: found.settlement.reference, payments: found.items.length };
    }
}
