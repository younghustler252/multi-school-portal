/* Shapes for the API. Money is a whole number of kobo: a JSON number when it is safe, a digit string when it is not. */

export const koboOut = (v: bigint): number | string =>
    v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(v) : v.toString();

const dayOut = (d: Date): string => d.toISOString().slice(0, 10);

export const journalSummary = (j: any) => ({
    id: j.id, number: j.number, entryDate: dayOut(j.entryDate), description: j.description,
    sourceType: j.sourceType, sourceId: j.sourceId, purpose: j.purpose, status: j.status,
    totalKobo: koboOut(j.totalKobo), reversalOfId: j.reversalOfId, reversalReason: j.reversalReason,
    branchId: j.branchId, termId: j.termId, sessionId: j.sessionId,
    createdById: j.createdById, isSystemActor: j.isSystemActor, postedAt: j.postedAt,
});

export const journalDetail = (j: any) => ({
    ...journalSummary(j),
    period: j.period ? { name: j.period.name, status: j.period.status } : null,
    lines: j.lines.map((l: any) => ({
        lineNumber: l.lineNumber, accountId: l.ledgerAccountId,
        accountCode: l.ledgerAccount?.code ?? null, accountName: l.ledgerAccount?.name ?? null,
        debitKobo: koboOut(l.debitKobo), creditKobo: koboOut(l.creditKobo),
        partyType: l.partyType, partyId: l.partyId, memo: l.memo,
    })),
});

export const periodOut = (p: any) => ({
    id: p.id, name: p.name, startDate: dayOut(p.startDate), endDate: dayOut(p.endDate), status: p.status,
    closedAt: p.closedAt, reopenedAt: p.reopenedAt, reopenReason: p.reopenReason,
});

export const balanceRowOut = (r: any) => ({
    accountId: r.accountId, code: r.code, name: r.name, type: r.type, subtype: r.subtype, systemKey: r.systemKey,
    isMoneyAccount: r.isMoneyAccount, debitKobo: koboOut(r.debitKobo), creditKobo: koboOut(r.creditKobo), balanceKobo: koboOut(r.balanceKobo),
});

export const cashBookOut = (b: any) => ({
    account: b.account, from: b.from, to: b.to,
    openingKobo: koboOut(b.openingKobo), totalInKobo: koboOut(b.totalInKobo), totalOutKobo: koboOut(b.totalOutKobo), closingKobo: koboOut(b.closingKobo),
    lines: b.lines.map((l: any) => ({ ...l, inKobo: koboOut(l.inKobo), outKobo: koboOut(l.outKobo), balanceKobo: koboOut(l.balanceKobo) })),
});
