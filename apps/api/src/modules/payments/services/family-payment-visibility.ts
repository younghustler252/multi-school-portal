import { ReceiptSnapshot } from "../domain/payment.entity";

/*
|--------------------------------------------------------------------------
| WHAT A GUARDIAN MAY SEE OF A PAYMENT AND ITS RECEIPT
|--------------------------------------------------------------------------
| A payment can cover several students (one transfer for two children, a cash payment spread over a family). A guardian
| may see:
|   - a payment they MADE (they are the payer), and
|   - a confirmed payment that covers one of THEIR linked children, even if somebody else made it.
|
| But never another child's details:
|   - lines and credit for THEIR children show in full (invoice number, student name, amount, balance after).
|   - lines and credit for OTHER children:
|       * the payer sees them as ONE anonymous amount ("other students"), so the total still adds up: no names,
|         invoice numbers or balances.
|       * a guardian who is not the payer does not see them at all, and sees only their own children's share as the
|         amount (partial = true).
|   - the payer's phone number and the payment's reference are shown to the payer only.
| Anything that fails these rules is "not found" (never "forbidden"), so nothing about it is confirmed.
|--------------------------------------------------------------------------
*/

export interface FamilyReceipt {
    receiptNumber: string; issuedAt: string; paidOn: string; status: string;
    school: ReceiptSnapshot["school"];
    payer: { type: ReceiptSnapshot["payer"]["type"]; name: string | null; phone: string | null };
    method: ReceiptSnapshot["method"]; reference: string | null;
    /** Payer: what they paid in all. Anyone else: the share that covers their own children. Kobo, as digits. */
    amountKobo: string;
    /** True when amountKobo is only the share for the viewer's children (the viewer did not make the payment). */
    partial: boolean;
    lines: ReceiptSnapshot["lines"];
    credit: ReceiptSnapshot["credit"];
    /** Payer only: the part that covers students who are not the viewer's children, with nothing that identifies them. */
    otherStudents: { amountKobo: string } | null;
}

const big = (s: string): bigint => { try { return BigInt(s); } catch { return 0n; } };

/** The receipt as this guardian may see it, or null when they may not see it at all. */
export function receiptForGuardian(snapshot: ReceiptSnapshot, v: { isPayer: boolean; childIds: ReadonlySet<string>; status: string }): FamilyReceipt | null {
    const mine = (studentId: string) => v.childIds.has(studentId);

    const myLines = snapshot.lines.filter(l => mine(l.studentId));
    const otherLines = snapshot.lines.filter(l => !mine(l.studentId));
    const myCredit = snapshot.credit && mine(snapshot.credit.studentId) ? snapshot.credit : null;
    const otherCredit = snapshot.credit && !mine(snapshot.credit.studentId) ? snapshot.credit : null;

    const coversMyChild = myLines.length > 0 || myCredit !== null;
    if (!v.isPayer && !coversMyChild) return null;

    const myShare = myLines.reduce((s, l) => s + big(l.amountKobo), 0n) + (myCredit ? big(myCredit.amountKobo) : 0n);
    const othersShare = otherLines.reduce((s, l) => s + big(l.amountKobo), 0n) + (otherCredit ? big(otherCredit.amountKobo) : 0n);

    return {
        receiptNumber: snapshot.receiptNumber, issuedAt: snapshot.issuedAt, paidOn: snapshot.paidOn, status: v.status,
        school: snapshot.school,
        payer: { type: snapshot.payer.type, name: snapshot.payer.name, phone: v.isPayer ? snapshot.payer.phone : null },
        method: snapshot.method, reference: v.isPayer ? snapshot.reference : null,
        amountKobo: v.isPayer ? snapshot.amountKobo : myShare.toString(),
        partial: !v.isPayer,
        lines: myLines, credit: myCredit,
        otherStudents: v.isPayer && othersShare > 0n ? { amountKobo: othersShare.toString() } : null,
    };
}

/** The kobo of a payment that went to the given students (credit included), whatever its state. */
export function shareForStudents(allocations: { studentId: string; amountKobo: bigint }[], childIds: ReadonlySet<string>): bigint {
    return allocations.filter(a => childIds.has(a.studentId)).reduce((s, a) => s + a.amountKobo, 0n);
}
