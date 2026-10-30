import type { AccountBalanceRow, CashBook } from "../domain/cash-book";
import { koboOut } from "./kobo";

export class LedgerReportMapper {
    balanceRow(r: AccountBalanceRow) {
        return {
            accountId: r.accountId, code: r.code, name: r.name, type: r.type, subtype: r.subtype, systemKey: r.systemKey,
            isMoneyAccount: r.isMoneyAccount, debitKobo: koboOut(r.debitKobo), creditKobo: koboOut(r.creditKobo), balanceKobo: koboOut(r.balanceKobo),
        };
    }

    cashBook(b: CashBook) {
        return {
            account: b.account, from: b.from, to: b.to,
            openingKobo: koboOut(b.openingKobo), totalInKobo: koboOut(b.totalInKobo), totalOutKobo: koboOut(b.totalOutKobo), closingKobo: koboOut(b.closingKobo),
            lines: b.lines.map(l => ({ ...l, inKobo: koboOut(l.inKobo), outKobo: koboOut(l.outKobo), balanceKobo: koboOut(l.balanceKobo) })),
        };
    }
}
