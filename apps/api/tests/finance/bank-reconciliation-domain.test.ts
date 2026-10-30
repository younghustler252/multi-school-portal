/*
| BANK RECONCILIATION: the pure rules (statement CSV, deduplication, matching, the reconciliation arithmetic).
| No database and no network; money is whole kobo and signed (in +, out -).
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBankCsv, parseBankDate, parseNairaToKobo, splitCsv } from "../../src/modules/bank-reconciliation/domain/bank-csv";
import { withDedupeKeys, statementFingerprint } from "../../src/modules/bank-reconciliation/domain/bank-lines";
import { suggestMatches, checkMatchGroup, dropReversalPairs, dayDiff } from "../../src/modules/bank-reconciliation/domain/matching";
import { summarise, statementBalanceAt, bookAmount } from "../../src/modules/bank-reconciliation/domain/reconciliation-math";

const N = (naira: number) => BigInt(Math.round(naira * 100));

describe("bank csv: money and dates", () => {
    it("reads naira text as whole kobo without floating point", () => {
        assert.equal(parseNairaToKobo("1,234.50"), 123450n);
        assert.equal(parseNairaToKobo("₦ 50,000"), 5_000_000n);
        assert.equal(parseNairaToKobo("NGN2,500.5"), 250050n);
        assert.equal(parseNairaToKobo("(500.00)"), -50000n);
        assert.equal(parseNairaToKobo("-12.34"), -1234n);
        assert.equal(parseNairaToKobo("12.34-"), -1234n);
        assert.equal(parseNairaToKobo("0.10"), 10n);
        assert.equal(parseNairaToKobo(".5"), 50n);
        assert.equal(parseNairaToKobo("123.4500"), 12345n);               // extra zeros are harmless
        assert.equal(parseNairaToKobo("9007199254740993.99"), 900719925474099399n);   // beyond Number's safe range, still exact
    });

    it("refuses anything that is not a clean amount", () => {
        for (const bad of ["", "-", "abc", "1,23.4", "1.2.3", "12.345", "1,2345", "12 USD"]) assert.equal(parseNairaToKobo(bad), null, bad);
        assert.equal(parseNairaToKobo(null), null);
        assert.equal(parseNairaToKobo(undefined), null);
    });

    it("reads dates day first, and also ISO and written months", () => {
        assert.equal(parseBankDate("05/10/2026"), "2026-10-05");
        assert.equal(parseBankDate("5-10-26"), "2026-10-05");
        assert.equal(parseBankDate("05.10.2026 14:22"), "2026-10-05");
        assert.equal(parseBankDate("2026-10-05"), "2026-10-05");
        assert.equal(parseBankDate("2026-10-05T14:22:01Z"), "2026-10-05");
        assert.equal(parseBankDate("05 Oct 2026"), "2026-10-05");
        assert.equal(parseBankDate("5-October-2026"), "2026-10-05");
        assert.equal(parseBankDate("29/02/2028"), "2028-02-29");
    });

    it("refuses dates that do not exist", () => {
        for (const bad of ["31/04/2026", "29/02/2027", "13/13/2026", "00/10/2026", "5 Foo 2026", "tomorrow", ""]) assert.equal(parseBankDate(bad), null, bad);
    });
});

describe("bank csv: the file", () => {
    it("splits quoted cells that hold commas, quotes and line breaks", () => {
        const rows = splitCsv('a,b,c\r\n"x, y","say ""hi""","line1\nline2"\n', ",");
        assert.deepEqual(rows[1], ["x, y", 'say "hi"', "line1\nline2"]);
    });

    const DEBIT_CREDIT = [
        "Account: Greenfield Schools 0123456789,,,,",
        "Statement period 01/10/2026 - 31/10/2026,,,,",
        "Date,Narration,Reference,Debit,Credit,Balance",
        "01/10/2026,Opening Balance,,,,\"1,000,000.00\"",
        "02/10/2026,\"NIP transfer from A. Bello, school fees\",NIP001,,\"50,000.00\",\"1,050,000.00\"",
        "03/10/2026,POS purchase,POS77,\"15,000.00\",,\"1,035,000.00\"",
        "05/10/2026,SMS alert charge,,50.00,,\"1,034,950.00\"",
        ",,,,,",
        "Total,,,\"15,050.00\",\"50,000.00\",",
    ].join("\n");

    it("reads debit and credit columns as signed lines, skipping the preamble, the opening row and the totals", () => {
        const s = parseBankCsv(DEBIT_CREDIT);
        assert.deepEqual(s.problems, []);
        assert.deepEqual(s.lines.map(l => [l.date, l.amountKobo, l.reference]), [
            ["2026-10-02", N(50_000), "NIP001"],
            ["2026-10-03", -N(15_000), "POS77"],
            ["2026-10-05", -N(50), null],
        ]);
        assert.equal(s.lines[0].description, "NIP transfer from A. Bello, school fees");
        assert.equal(s.openingBalanceKobo, N(1_000_000));
        assert.equal(s.closingBalanceKobo, N(1_034_950));
    });

    it("reads one signed amount column, and a semicolon file", () => {
        const s = parseBankCsv("Transaction Date;Details;Amount;Balance\n2026-10-02;Fees;50000.00;150000.00\n2026-10-03;Charge;-52.50;149947.50\n");
        assert.deepEqual(s.lines.map(l => l.amountKobo), [N(50_000), -N(52.5)]);
        assert.equal(s.closingBalanceKobo, N(149_947.5));
    });

    it("puts a newest-first file into time order", () => {
        const s = parseBankCsv("Date,Description,Credit,Debit,Balance\n05/10/2026,C,,10.00,90.00\n04/10/2026,B,,10.00,100.00\n03/10/2026,A,110.00,,110.00\n");
        assert.deepEqual(s.lines.map(l => l.description), ["A", "B", "C"]);
        assert.equal(s.openingBalanceKobo, 0n);
        assert.equal(s.closingBalanceKobo, N(90));
    });

    it("keeps loading when a row is bad, and says which row", () => {
        const s = parseBankCsv("Date,Description,Debit,Credit\n02/10/2026,Good,,10.00\n31/04/2026,Bad date,,10.00\n03/10/2026,Both,5.00,5.00\n04/10/2026,No money,,\n05/10/2026,Also good,20.00,\n");
        assert.equal(s.lines.length, 2);
        assert.deepEqual(s.problems.map(p => p.row), [3, 4, 5]);
        assert.match(s.problems[0].message, /31\/04\/2026/);
    });

    it("says what is missing when there is no usable header", () => {
        const s = parseBankCsv("Name,Age\nAda,30\n");
        assert.equal(s.lines.length, 0);
        assert.ok(s.missingColumns.length > 0);
    });

    it("handles a byte order mark and Windows line endings", () => {
        const s = parseBankCsv("﻿Date,Description,Amount\r\n02/10/2026,Fees,100.00\r\n");
        assert.equal(s.lines.length, 1);
        assert.equal(s.lines[0].amountKobo, N(100));
    });
});

describe("bank lines: deduplication", () => {
    const line = (date: string, amt: number, description: string, reference: string | null = null) => ({ date, amountKobo: N(amt), description, reference });

    it("the same lines always get the same keys", () => {
        const a = withDedupeKeys([line("2026-10-02", 100, "Fees"), line("2026-10-03", -5, "Charge")]);
        const b = withDedupeKeys([line("2026-10-02", 100, "Fees"), line("2026-10-03", -5, "Charge")]);
        assert.deepEqual(a.map(x => x.dedupeKey), b.map(x => x.dedupeKey));
        assert.equal(statementFingerprint(a.map(x => x.dedupeKey)), statementFingerprint(b.map(x => x.dedupeKey)));
    });

    it("two identical lines on one day stay two lines", () => {
        const k = withDedupeKeys([line("2026-10-02", 5000, "Fees A. Bello"), line("2026-10-02", 5000, "Fees A. Bello")]);
        assert.notEqual(k[0].dedupeKey, k[1].dedupeKey);
    });

    it("spacing and capital letters do not make a line new, but the amount does", () => {
        const [a] = withDedupeKeys([line("2026-10-02", 100, "Fees  A. BELLO")]);
        const [b] = withDedupeKeys([line("2026-10-02", 100, "fees a. bello")]);
        const [c] = withDedupeKeys([line("2026-10-02", 101, "fees a. bello")]);
        assert.equal(a.dedupeKey, b.dedupeKey);
        assert.notEqual(a.dedupeKey, c.dedupeKey);
    });

    it("an overlapping statement shares keys for the overlap only", () => {
        const first = withDedupeKeys([line("2026-10-30", 1, "x"), line("2026-10-31", 2, "y")]).map(x => x.dedupeKey);
        const second = withDedupeKeys([line("2026-10-31", 2, "y"), line("2026-11-01", 3, "z")]).map(x => x.dedupeKey);
        assert.equal(first[1], second[0]);
        assert.notEqual(first[0], second[1]);
    });
});

describe("matching", () => {
    const bank = (id: string, date: string, amt: number, description = "", reference: string | null = null) => ({ id, date, amountKobo: N(amt), description, reference });
    const book = (id: string, date: string, amt: number, text = "") => ({ id, date, amountKobo: N(amt), text });

    it("pairs equal amounts dated close together", () => {
        const s = suggestMatches([bank("b1", "2026-10-05", 50_000)], [book("k1", "2026-10-03", 50_000)], 3);
        assert.deepEqual(s.map(x => [x.bankLineId, x.journalLineIds, x.ambiguous]), [["b1", ["k1"], false]]);
    });

    it("does not pair different amounts, opposite signs or dates beyond the tolerance", () => {
        assert.equal(suggestMatches([bank("b1", "2026-10-05", 100)], [book("k1", "2026-10-05", 101)], 3).length, 0);
        assert.equal(suggestMatches([bank("b1", "2026-10-05", 100)], [book("k1", "2026-10-05", -100)], 3).length, 0);
        assert.equal(suggestMatches([bank("b1", "2026-10-05", 100)], [book("k1", "2026-10-10", 100)], 3).length, 0);
        assert.equal(suggestMatches([bank("b1", "2026-10-05", 100)], [book("k1", "2026-10-08", 100)], 3).length, 1);
    });

    it("two equal candidates are ambiguous, so they are shown but would not be applied", () => {
        const s = suggestMatches([bank("b1", "2026-10-05", 50_000)], [book("k1", "2026-10-05", 50_000), book("k2", "2026-10-05", 50_000)], 3);
        assert.equal(s.length, 1);
        assert.equal(s[0].ambiguous, true);
    });

    it("a closer date breaks the tie", () => {
        const s = suggestMatches([bank("b1", "2026-10-05", 50_000)], [book("k1", "2026-10-02", 50_000), book("k2", "2026-10-05", 50_000)], 3);
        assert.deepEqual(s[0].journalLineIds, ["k2"]);
        assert.equal(s[0].ambiguous, false);
    });

    it("a shared reference breaks a tie that dates cannot, and says so", () => {
        const s = suggestMatches(
            [bank("b1", "2026-10-05", 50_000, "NIP transfer", "FT26280ABC")],
            [book("k1", "2026-10-05", 50_000, "Payment PAY-1 A. Bello"), book("k2", "2026-10-05", 50_000, "Payment PAY-2 ft26280abc")], 3);
        assert.deepEqual(s[0].journalLineIds, ["k2"]);
        assert.equal(s[0].reason, "REFERENCE");
        assert.equal(s[0].ambiguous, false);
    });

    it("pairs several bank lines one to one and never uses a book line twice", () => {
        const s = suggestMatches(
            [bank("b1", "2026-10-05", 100), bank("b2", "2026-10-06", 100), bank("b3", "2026-10-07", 250)],
            [book("k1", "2026-10-05", 100), book("k2", "2026-10-06", 100)], 3);
        const used = s.flatMap(x => x.journalLineIds);
        assert.equal(new Set(used).size, used.length);
        assert.equal(s.length, 2);
        assert.deepEqual(s.find(x => x.bankLineId === "b1")!.journalLineIds, ["k1"]);
        assert.deepEqual(s.find(x => x.bankLineId === "b2")!.journalLineIds, ["k2"]);
    });

    it("gives the same answer every time", () => {
        const b = [bank("b1", "2026-10-05", 100), bank("b2", "2026-10-05", 100)], k = [book("k1", "2026-10-05", 100), book("k2", "2026-10-05", 100)];
        assert.deepEqual(suggestMatches(b, k, 3), suggestMatches([...b].reverse(), [...k].reverse(), 3).sort((x, y) => x.bankLineId.localeCompare(y.bankLineId)));
    });

    it("counts days across month ends", () => {
        assert.equal(dayDiff("2026-10-31", "2026-11-02"), 2);
        assert.equal(dayDiff("2026-11-02", "2026-10-31"), 2);
    });

    it("a hand made match needs both sides and equal totals", () => {
        assert.deepEqual(checkMatchGroup([N(100)], [N(60), N(40)]), { ok: true });
        const differ = checkMatchGroup([N(100)], [N(60)]);
        assert.equal(differ.ok, false);
        if (!differ.ok) { assert.equal(differ.reason, "TOTALS_DIFFER"); assert.equal(differ.bankTotalKobo, N(100)); assert.equal(differ.bookTotalKobo, N(60)); }
        const none = checkMatchGroup([], [N(60)]);
        assert.equal(none.ok === false && none.reason, "NEEDS_BOTH_SIDES");
    });

    it("drops a reversed journal and its reversal when both are unmatched, and keeps a reversal whose original is gone", () => {
        const orig = { id: "l1", journalId: "j1", lineNumber: 1, reversalOfJournalId: null };
        const rev = { id: "l2", journalId: "j2", lineNumber: 1, reversalOfJournalId: "j1" };
        const other = { id: "l3", journalId: "j3", lineNumber: 1, reversalOfJournalId: null };
        assert.deepEqual(dropReversalPairs([orig, rev, other]).map(l => l.id), ["l3"]);
        assert.deepEqual(dropReversalPairs([rev, other]).map(l => l.id), ["l2", "l3"]);          // the original was matched, so it is not in the list
        const orig2 = { id: "l4", journalId: "j1", lineNumber: 2, reversalOfJournalId: null };
        assert.deepEqual(dropReversalPairs([orig, orig2, rev]).map(l => l.id), ["l4"]);          // only the lines that really pair up go
    });
});

describe("the reconciliation statement", () => {
    it("a cheque the bank has not cashed is explained by the outstanding item", () => {
        // books: N90,000 after paying a N10,000 cheque; the bank still shows N100,000
        const s = summarise({ statementBalanceKobo: N(100_000), bookBalanceKobo: N(90_000), outstandingBookKobo: -N(10_000), unmatchedBankKobo: 0n, unmatchedBankCount: 0 });
        assert.equal(s.adjustedBankKobo, N(90_000));
        assert.equal(s.adjustedBookKobo, N(90_000));
        assert.equal(s.differenceKobo, 0n);
        assert.equal(s.canComplete, true);
    });

    it("a deposit in transit works the same way in the other direction", () => {
        const s = summarise({ statementBalanceKobo: N(100_000), bookBalanceKobo: N(130_000), outstandingBookKobo: N(30_000), unmatchedBankKobo: 0n, unmatchedBankCount: 0 });
        assert.equal(s.differenceKobo, 0n);
    });

    it("a bank charge the books do not have yet agrees, but the month cannot be completed until it is recorded", () => {
        const s = summarise({ statementBalanceKobo: N(99_500), bookBalanceKobo: N(100_000), outstandingBookKobo: 0n, unmatchedBankKobo: -N(500), unmatchedBankCount: 1 });
        assert.equal(s.differenceKobo, 0n);
        assert.equal(s.canComplete, false);
    });

    it("a real difference is shown with its sign", () => {
        const s = summarise({ statementBalanceKobo: N(100_000), bookBalanceKobo: N(95_000), outstandingBookKobo: 0n, unmatchedBankKobo: 0n, unmatchedBankCount: 0 });
        assert.equal(s.differenceKobo, N(5_000));
        assert.equal(s.canComplete, false);
    });

    it("signs a journal line by its side, and finds the bank's balance at a month end", () => {
        assert.equal(bookAmount(N(10), 0n), N(10));
        assert.equal(bookAmount(0n, N(10)), -N(10));
        const lines = [
            { date: "2026-10-30", balanceKobo: N(100) }, { date: "2026-10-31", balanceKobo: null }, { date: "2026-11-02", balanceKobo: N(120) },
        ];
        assert.equal(statementBalanceAt(lines, "2026-10-31"), N(100));
        assert.equal(statementBalanceAt(lines, "2026-11-30"), N(120));
        assert.equal(statementBalanceAt(lines, "2026-10-01"), null);
    });
});
