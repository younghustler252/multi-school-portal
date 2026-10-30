/*
|--------------------------------------------------------------------------
| MATCHING a bank line to the book entry that records the same money. Pure functions.
|
| Both sides are SIGNED the same way: money into the account is positive, money out is negative.
|   bank line  the amount as printed on the statement (credit +, debit -)
|   book line  debit minus credit on the bank account's journal line
| so a pair matches when the two numbers are equal.
|
| Suggestions are one to one: equal amount, dated within a few days of each other. A shared reference or similar wording
| raises the score. A suggestion is AMBIGUOUS when another candidate scores just as well (two N50,000 deposits on the same
| day): those are shown for a person to decide and are never applied automatically.
| A deposit that covers several payments (one bank line, many book lines) is matched by hand with checkMatchGroup.
|--------------------------------------------------------------------------
*/

export interface BankFacts { id: string; date: string; amountKobo: bigint; description: string; reference: string | null }
export interface BookFacts { id: string; date: string; amountKobo: bigint; text: string }

export type SuggestionReason = "REFERENCE" | "AMOUNT_AND_DATE";
export interface Suggestion { bankLineId: string; journalLineIds: string[]; score: number; reason: SuggestionReason; ambiguous: boolean }

const MS_PER_DAY = 86_400_000;
export const dayDiff = (a: string, b: string): number =>
    Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / MS_PER_DAY));

const words = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string): Set<string> => new Set(words(s).split(" ").filter(t => t.length >= 4));

interface Pair { bank: BankFacts; book: BookFacts; score: number; diff: number; reason: SuggestionReason }

function scorePair(bank: BankFacts, book: BookFacts, diff: number, bankTokens: Set<string>, bookText: string, bookTokens: Set<string>): Pair {
    let score = 100 - diff * 10;
    const ref = words(bank.reference ?? "").replace(/ /g, "");
    const referenceHit = ref.length >= 4 && words(bookText).replace(/ /g, "").includes(ref);
    if (referenceHit) score += 50;
    let shared = 0;
    for (const t of bankTokens) if (bookTokens.has(t)) shared++;
    score += Math.min(20, shared * 5);
    return { bank, book, score, diff, reason: referenceHit ? "REFERENCE" : "AMOUNT_AND_DATE" };
}

export function suggestMatches(bank: BankFacts[], book: BookFacts[], toleranceDays: number): Suggestion[] {
    const byAmount = new Map<string, BookFacts[]>();
    for (const k of book) {
        const key = k.amountKobo.toString();
        (byAmount.get(key) ?? byAmount.set(key, []).get(key)!).push(k);
    }

    const pairs: Pair[] = [];
    for (const b of bank) {
        const candidates = byAmount.get(b.amountKobo.toString());
        if (!candidates) continue;
        const bankTokens = tokens(`${b.description} ${b.reference ?? ""}`);
        for (const k of candidates) {
            const diff = dayDiff(b.date, k.date);
            if (diff > toleranceDays) continue;
            pairs.push(scorePair(b, k, diff, bankTokens, k.text, tokens(k.text)));
        }
    }

    // For each line, how good is its best candidate and how many candidates tie for it
    const best = (side: "bank" | "book") => {
        const m = new Map<string, { score: number; count: number }>();
        for (const p of pairs) {
            const id = side === "bank" ? p.bank.id : p.book.id;
            const cur = m.get(id);
            if (!cur || p.score > cur.score) m.set(id, { score: p.score, count: 1 });
            else if (p.score === cur.score) cur.count++;
        }
        return m;
    };
    const bestForBank = best("bank"), bestForBook = best("book");

    // Greedy one to one, strongest pairs first; ties broken by ids so the result never changes between runs
    const ordered = [...pairs].sort((a, b) =>
        b.score - a.score || a.diff - b.diff || a.bank.id.localeCompare(b.bank.id) || a.book.id.localeCompare(b.book.id));
    const usedBank = new Set<string>(), usedBook = new Set<string>();
    const out: Suggestion[] = [];
    for (const p of ordered) {
        if (usedBank.has(p.bank.id) || usedBook.has(p.book.id)) continue;
        usedBank.add(p.bank.id); usedBook.add(p.book.id);
        const bb = bestForBank.get(p.bank.id)!, bk = bestForBook.get(p.book.id)!;
        const ambiguous = bb.count > 1 || bk.count > 1 || p.score < bb.score || p.score < bk.score;
        out.push({ bankLineId: p.bank.id, journalLineIds: [p.book.id], score: p.score, reason: p.reason, ambiguous });
    }
    return out;
}

/*
| A hand made match may pair several bank lines with several book lines (a deposit covering three payments), as long as
| the two sides add up to the same amount. At least one bank line and one book line are needed.
*/
export type GroupCheck = { ok: true } | { ok: false; reason: "NEEDS_BOTH_SIDES" | "TOTALS_DIFFER"; bankTotalKobo: bigint; bookTotalKobo: bigint };

export function checkMatchGroup(bankAmounts: bigint[], bookAmounts: bigint[]): GroupCheck {
    const bankTotalKobo = bankAmounts.reduce((s, a) => s + a, 0n), bookTotalKobo = bookAmounts.reduce((s, a) => s + a, 0n);
    if (bankAmounts.length === 0 || bookAmounts.length === 0) return { ok: false, reason: "NEEDS_BOTH_SIDES", bankTotalKobo, bookTotalKobo };
    if (bankTotalKobo !== bookTotalKobo) return { ok: false, reason: "TOTALS_DIFFER", bankTotalKobo, bookTotalKobo };
    return { ok: true };
}

/*
| A reversed journal and its reversal cancel each other on the account, so neither needs a bank line. When both are still
| unmatched they are taken out of the lists. (If the original WAS matched to a bank line, its reversal stays: the bank has to
| show the money coming back, and the reversal is matched or recorded like any other line.)
| The reversal's lines are the original's lines with the sides swapped, in the same order, so line n pairs with line n.
*/
export interface PairableBookLine { journalId: string; lineNumber: number; reversalOfJournalId: string | null }

export function dropReversalPairs<T extends PairableBookLine>(lines: T[]): T[] {
    const originals = new Map<string, T>(), reversals = new Map<string, T>();
    for (const l of lines) {
        if (l.reversalOfJournalId) reversals.set(`${l.reversalOfJournalId}:${l.lineNumber}`, l);
        else originals.set(`${l.journalId}:${l.lineNumber}`, l);
    }
    const drop = new Set<T>();
    for (const [key, rev] of reversals) {
        const orig = originals.get(key);
        if (orig) { drop.add(orig); drop.add(rev); }
    }
    return lines.filter(l => !drop.has(l));
}
