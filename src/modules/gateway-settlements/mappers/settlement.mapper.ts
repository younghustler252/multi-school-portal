import { koboOut } from "../../ledger/mappers/kobo";
import { OnlinePaymentFacts, SettlementEntity, SettlementItemEntity } from "../domain/settlement.entity";
import { SettlementGroup } from "../domain/settlement-report";

export class SettlementMapper {
    settlement(s: SettlementEntity) {
        return {
            id: s.id, provider: s.provider, reference: s.reference, settledOn: s.settledOn,
            grossKobo: koboOut(s.grossKobo), feeKobo: koboOut(s.feeKobo), netKobo: koboOut(s.netKobo),
            account: { id: s.accountId, name: s.accountName }, journalId: s.journalId, journalNumber: s.journalNumber, itemCount: s.itemCount,
            note: s.note, createdAt: s.createdAt.toISOString(), reversed: s.reversedAt !== null, reversedAt: s.reversedAt?.toISOString() ?? null, reverseReason: s.reverseReason,
        };
    }
    item(i: SettlementItemEntity) {
        return { paymentId: i.paymentId, reference: i.reference, payerName: i.payerName, amountKobo: koboOut(i.amountKobo), feeKobo: koboOut(i.feeKobo) };
    }
    payment(p: OnlinePaymentFacts) {
        return { id: p.id, reference: p.reference, payerName: p.payerName, amountKobo: koboOut(p.amountKobo), paidAt: p.paidAt };
    }
    group(g: SettlementGroup) {
        return {
            settlementRef: g.settlementRef, settledOn: g.settledOn, clean: g.clean, itemCount: g.items.length,
            grossKobo: koboOut(g.grossKobo), feeKobo: koboOut(g.feeKobo), netKobo: koboOut(g.netKobo),
            problems: g.problems.slice(0, 50), problemCount: g.problems.length,
        };
    }
}
