import { randomBytes, randomUUID } from "node:crypto";
import { IPaymentRepository } from "../repositories/payment.repository";
import { IPaymentContextRepository } from "../repositories/payment-context.repository";
import { IFeeInvoiceRepository } from "../../fees/repositories/fee-invoice.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { PaymentConfirmationService } from "../services/payment-confirmation.service";
import { PostingService } from "../../ledger/services/posting.service";
import { PaymentMapper } from "../mappers/payment.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { ActorType } from "../../audit/domain/audit.enums";
import { PaymentProviderError } from "../../../infrastructure/payments/interfaces/payment.provider.interface";
import type { IPaymentProvider } from "../../../infrastructure/payments/interfaces/payment.provider.interface";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { paymentErrors } from "../domain/payment.errors";
import { AppError } from "../../../shared/errors/domain.errors";
import { InitializeOnlinePaymentDtoType, RecordSettlementDtoType } from "../dtos/payment.dto";

interface Dependencies {
    paymentRepository: IPaymentRepository; paymentContextRepository: IPaymentContextRepository; feeInvoiceRepository: IFeeInvoiceRepository;
    ledgerAccountRepository: ILedgerAccountRepository; paymentConfirmationService: PaymentConfirmationService; postingService: PostingService;
    paymentMapper: PaymentMapper; auditService: AuditService; paymentProvider: IPaymentProvider;
    mailService?: { sendPaymentReceipt(p: { to: string; firstName: string; schoolName: string; amount: string; reference: string; date: string }): Promise<void> };
}

export interface OnlineOptions { now?: () => Date }

const SYSTEM_ACTOR = "SYSTEM_PAYMENTS";
const kobo = (v: bigint): number => { if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw paymentErrors.gatewayFailed("That amount is too large for the gateway"); return Number(v); };

/*
| PAY ONLINE (brief rule 4, section 8.5). A guardian starts a payment for one of their children's invoices. We save a PENDING payment first
| (its reference is what the gateway echoes back), pointed at the ONLINE CLEARING account, then ask the gateway for a payment page.
| Nothing is posted until the gateway confirms the money. If the gateway refuses to start, the payment is marked failed at once.
*/
export class InitializeOnlinePaymentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, guardianId: string, dto: InitializeOnlinePaymentDtoType) {
        const d = this.d;
        const [inv] = await d.feeInvoiceRepository.findManyByIds([dto.invoiceId]);
        if (!inv) throw paymentErrors.invoiceNotPayable(dto.invoiceId);
        if (!(await d.paymentContextRepository.guardianChildIds(guardianId)).includes(inv.studentId)) throw paymentErrors.notYourChild();
        if ((inv.status !== "unpaid" && inv.status !== "partial") || inv.balanceKobo <= 0n) throw paymentErrors.invoiceNotPayable(inv.id);

        const contact = await d.paymentContextRepository.guardianContact(guardianId);
        if (!contact) throw paymentErrors.guardianNotFound();
        const [clearing] = await d.ledgerAccountRepository.findPostable([], ["ONLINE_CLEARING"]);
        if (!clearing) throw paymentErrors.accountInvalid("The online payments clearing account is missing from the chart of accounts");

        const amount = dto.amountKobo ?? inv.balanceKobo;
        const reference = `PAY-${randomBytes(6).toString("hex").toUpperCase()}`;
        const payment = await d.paymentRepository.createPayment({
            payerType: "GUARDIAN", guardianId, payerName: contact.name, payerPhone: contact.phone, branchId: inv.branchId, method: "paystack",
            amountKobo: amount, unallocatedKobo: 0n, accountId: clearing.id, status: "PENDING", reference, targetStudentIds: [inv.studentId],
        });

        try {
            const init = await d.paymentProvider.initializeTransaction({
                email: contact.email, amountKobo: kobo(amount), reference, callbackUrl: dto.callbackUrl,
                subaccount: (await d.paymentContextRepository.subaccountCode(schoolId)) ?? undefined,
                metadata: { type: "school_fee", schoolId, paymentId: payment.id, invoiceId: inv.id },
            });
            return { paymentId: payment.id, reference: init.reference, authorizationUrl: init.authorizationUrl, amountKobo: kobo(amount) };
        } catch (e) {
            await d.paymentRepository.markFailed(payment.id, payment.version, { reversalReason: "The gateway could not start the payment" });
            if (e instanceof PaymentProviderError) throw paymentErrors.gatewayFailed("The payment gateway could not start the payment. Try again");
            throw e;
        }
    }
}

export interface ConfirmOutcome { payment: ReturnType<PaymentMapper["toResponse"]>; state: "confirmed" | "already" | "failed" | "pending" }

/*
| CONFIRM AN ONLINE PAYMENT from what the gateway says (the webhook, the guardian's return visit and the reconciliation job all come here).
| The gateway is asked directly (never trusted from the caller). On success the amount must equal what was asked for, then the SAME confirmation
| used for cash runs: allocate, post (Dr clearing, Cr receivable and advance), receipt. Safe to call any number of times: a payment already
| confirmed is returned as it is, and two callers racing end with one confirmation.
*/
export class ConfirmOnlinePaymentUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: OnlineOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(reference: string, schoolId: string, onlyForGuardianId?: string): Promise<ConfirmOutcome> {
        const d = this.d;
        const p = await d.paymentRepository.findByReference(reference);
        if (!p || p.method !== "paystack") throw paymentErrors.paymentNotFound();
        if (onlyForGuardianId && p.guardianId !== onlyForGuardianId) throw paymentErrors.notYourPayment();
        const out = (payment: typeof p, state: ConfirmOutcome["state"]): ConfirmOutcome => ({ payment: d.paymentMapper.toResponse(payment), state });

        if (p.status === "CONFIRMED" || p.status === "REVERSED") return out(p, "already");
        if (p.status === "FAILED") return out(p, "failed");

        const v = await d.paymentProvider.verifyTransaction(reference);
        if (v.status === "pending") return out(p, "pending");
        if (v.status !== "success") {
            await d.paymentRepository.markFailed(p.id, p.version, { channel: v.channel ?? null, providerResponse: v as any, webhookVerified: true, reversalReason: v.gatewayResponse ?? v.status });
            return out((await d.paymentRepository.findById(p.id))!, "failed");
        }

        if (BigInt(v.amountKobo) !== p.amountKobo) {
            await d.auditService.log({
                userId: SYSTEM_ACTOR, actorType: ActorType.SYSTEM, schoolId, action: "payments.online.amount_mismatch", entity: "Payment", entityId: p.id,
                newValue: { reference, paidKobo: String(v.amountKobo), expectedKobo: p.amountKobo.toString() },
            });
            throw paymentErrors.amountMismatch(BigInt(v.amountKobo), p.amountKobo);
        }

        await d.paymentRepository.setGatewayResult(p.id, { channel: v.channel ?? null, providerResponse: v as any, webhookVerified: true, paidAt: v.paidAt ?? this.now() });
        let confirmed;
        try {
            confirmed = await d.paymentConfirmationService.confirm(p.id, { actorUserId: null, schoolId });
        } catch (e) {
            if (e instanceof AppError && ["PAYMENT_CHANGED", "PAYMENT_NOT_WAITING", "INVOICE_CHANGED", "DUPLICATE_POSTING"].includes(e.code ?? "")) {
                const now = await d.paymentRepository.findById(p.id);                       // another caller may have confirmed it first
                if (now?.status === "CONFIRMED") return out(now, "already");
            }
            throw e;
        }

        await d.auditService.log({
            userId: SYSTEM_ACTOR, actorType: ActorType.SYSTEM, schoolId, action: "payments.online.confirmed", entity: "Payment", entityId: p.id,
            newValue: { reference, amountKobo: p.amountKobo.toString(), receiptNumber: confirmed.receiptNumber, creditKobo: confirmed.unallocatedKobo.toString() },
        });
        await this.sendReceipt(confirmed, v.customerEmail, schoolId);
        return out(confirmed, "confirmed");
    }

    // Best effort: a mail problem never undoes a confirmed payment
    private async sendReceipt(p: { payerName: string | null; amountKobo: bigint; receiptNumber: string | null; reference: string | null }, email: string | undefined, schoolId: string) {
        if (!this.d.mailService || !email) return;
        try {
            const header = await this.d.paymentContextRepository.schoolHeader(schoolId);
            await this.d.mailService.sendPaymentReceipt({
                to: email, firstName: p.payerName?.split(" ")[0] ?? "there", schoolName: header.name ?? "your school",
                amount: `₦${(Number(p.amountKobo) / 100).toLocaleString("en-NG")}`, reference: p.receiptNumber ?? p.reference ?? "", date: this.now().toLocaleDateString("en-NG"),
            });
        } catch (e) { console.error("Could not send the payment receipt mail:", e); }
    }
}

/*
| RECORD A SETTLEMENT (brief rule 4): the gateway paid the school's bank. Dr bank (what arrived), Dr bank and gateway charges (the fee),
| Cr online payments clearing (the gross). When every settlement is recorded, the clearing account is back to nothing.
| The same gateway settlement reference never posts twice.
*/
export class RecordSettlementUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: OnlineOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(schoolId: string, actorUserId: string, dto: RecordSettlementDtoType) {
        const d = this.d;
        const today = todayInFinanceZone(this.now());
        const on = dto.settledOn ?? today;
        parseDay(on);
        if (on > today) throw paymentErrors.futureDate();

        const repo = d.ledgerAccountRepository;
        const bank = dto.accountId ? await repo.findById(dto.accountId) : (await repo.findPostable([], ["BANK_DEFAULT"]))[0];
        if (!bank || !bank.isActive) throw paymentErrors.settlementInvalid("The bank account does not exist or is not active");
        if (!bank.isMoneyAccount || bank.subtype === "ONLINE_CLEARING") throw paymentErrors.settlementInvalid("A settlement must land in a bank or other money account");

        const received = dto.grossKobo - dto.feeKobo;
        const lines = [{ accountId: bank.id, debitKobo: received }] as any[];
        if (dto.feeKobo > 0n) lines.push({ systemKey: "BANK_CHARGES", debitKobo: dto.feeKobo });
        lines.push({ systemKey: "ONLINE_CLEARING", creditKobo: dto.grossKobo });

        const posted = await d.postingService.post({
            entryDate: on, description: `Online payments settled${dto.reference ? ` (${dto.reference})` : ""}${dto.note ? `: ${dto.note}` : ""}`,
            sourceType: "TRANSFER", sourceId: dto.reference ?? randomUUID(), purpose: "SETTLE", lines, actorUserId,
        });
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payments.online.settled", entity: "JournalEntry", entityId: posted.journal.id,
            newValue: { grossKobo: dto.grossKobo.toString(), feeKobo: dto.feeKobo.toString(), accountId: bank.id, settledOn: on, reference: dto.reference ?? null },
        });
        return { journalId: posted.journal.id, journalNumber: posted.journal.number, receivedKobo: Number(received), feeKobo: Number(dto.feeKobo), grossKobo: Number(dto.grossKobo) };
    }
}
