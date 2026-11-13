/*
| GUARDIAN PAYMENTS AND RECEIPTS, on a real database.
| A guardian sees what they paid, plus confirmed payments by other people that cover their own children (their share
| only). Never another family's child, never another payer's phone or reference, never someone's pending attempt.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { seed } from "../attendance/fixtures";
import { PaymentRepositoryImpl } from "../../src/modules/payments/repositories/payment.repository.impl";
import { PaymentContextRepositoryImpl } from "../../src/modules/payments/repositories/payment-context.repository.impl";
import { PaymentMapper } from "../../src/modules/payments/mappers/payment.mapper";
import { ListMyPaymentsUseCase, GetMyReceiptUseCase } from "../../src/modules/payments/usecases/family-payments.usecases";

const NOW = new Date("2026-02-10T09:00:00Z");

describe("guardian payments and receipts (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool;
    let W: any;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const deps = () => { const paymentMapper = new PaymentMapper(); return { paymentRepository: new PaymentRepositoryImpl({ paymentMapper } as any), paymentContextRepository: new PaymentContextRepositoryImpl(), paymentMapper } as any; };
    const list = async (guardianId: string, q: any = {}) => (await new ListMyPaymentsUseCase(deps()).execute(guardianId, { page: 1, limit: 100, ...q })).data;
    const ids = (rows: any[]) => rows.map(r => r.id).sort();
    const receipt = (paymentId: string, guardianId: string) => new GetMyReceiptUseCase(deps()).execute(paymentId, guardianId);
    const notFound = (e: any) => e?.statusCode === 404;

    before(async () => {
        school = await createTestSchool();
        W = await school.run(async () => {
            const S = await seed();                                       // s1 Ada (G1's child), s2 Bola, s4 Dayo; G1 = S.guardian, linked to s1
            const d = db();
            S.guardian = await d.guardian.update({ where: { id: S.guardian.id }, data: { phone: "0800Gina" } });   // the seed gives her none
            const mk = (firstName: string, email: string) => d.guardian.create({ data: { firstName, lastName: "Parent", email, phone: "0800" + firstName } });
            const G2 = await mk("Femi", "femi@x.com");                    // Ada's father: a second parent of s1
            const G3 = await mk("Tolu", "tolu@x.com");                    // another family: Dayo's parent
            const G4 = await mk("Nobody", "nobody@x.com");                // linked to no one
            await d.studentGuardian.create({ data: { guardianId: G2.id, studentId: S.s1.id, relation: "father", isPrimary: false } });
            await d.studentGuardian.create({ data: { guardianId: G3.id, studentId: S.s4.id, relation: "father", isPrimary: true } });
            const account = await d.ledgerAccount.create({ data: { code: "1000", name: "Cash", type: "ASSET", isMoneyAccount: true } });

            const names: Record<string, string> = { [S.s1.id]: "Ada Pupil", [S.s4.id]: "Dayo Pupil" };
            let n = 0;
            const pay = async (o: { key: string; payer: any; status: string; covers: [any, number][]; receipt?: boolean; phone?: string }) => {
                n++;
                const total = o.covers.reduce((s, [, k]) => s + k, 0);
                const p = await d.payment.create({ data: {
                    payerType: "GUARDIAN", guardianId: o.payer.id, payerName: `${o.payer.firstName} Parent`, payerPhone: o.payer.phone, method: "cash", amountKobo: BigInt(total), unallocatedKobo: 0n,
                    accountId: account.id, status: o.status, reference: `REF-${o.key}`, paidAt: NOW, createdAt: new Date(NOW.getTime() + n * 1000),
                    allocations: { create: o.covers.map(([s, k]) => ({ studentId: s.id, amountKobo: BigInt(k), invoiceId: null })) },
                } });
                if (o.receipt !== false) {
                    await d.receipt.create({ data: { receiptNumber: `RCT-${o.key}`, paymentId: p.id, issuedAt: NOW, snapshot: {
                        receiptNumber: `RCT-${o.key}`, issuedAt: NOW.toISOString(), paidOn: "2026-02-10",
                        school: { name: "Greenfield", address: null, logoUrl: null, principalName: null },
                        payer: { type: "GUARDIAN", name: `${o.payer.firstName} Parent`, phone: o.payer.phone }, method: "cash", reference: `REF-${o.key}`, amountKobo: String(total),
                        lines: o.covers.map(([s, k]) => ({ invoiceNumber: `INV-${o.key}-${names[s.id]?.split(" ")[0]}`, studentId: s.id, studentName: names[s.id], amountKobo: String(k), balanceAfterKobo: "0" })),
                        credit: null,
                    } } });
                }
                return p.id as string;
            };
            const P: Record<string, string> = {};
            P.own        = await pay({ key: "own",  payer: S.guardian, status: "CONFIRMED", covers: [[S.s1, 100]] });                    // G1 paid for Ada
            P.byOther    = await pay({ key: "oth",  payer: G3,         status: "CONFIRMED", covers: [[S.s1, 30], [S.s4, 70]] });         // G3 paid for Ada AND Dayo
            P.otherPend  = await pay({ key: "opd",  payer: G3,         status: "PENDING",   covers: [[S.s1, 10]], receipt: false });     // G3's attempt, not confirmed
            P.otherOnly  = await pay({ key: "oly",  payer: G3,         status: "CONFIRMED", covers: [[S.s4, 55]] });                     // G3 for Dayo only
            P.ownPend    = await pay({ key: "pnd",  payer: S.guardian, status: "PENDING",   covers: [[S.s1, 25]], receipt: false });     // G1's own pending
            P.mixedOwn   = await pay({ key: "mix",  payer: S.guardian, status: "CONFIRMED", covers: [[S.s1, 40], [S.s4, 60]] });         // G1 paid for Ada AND Dayo
            P.reversed   = await pay({ key: "rev",  payer: G3,         status: "REVERSED",  covers: [[S.s1, 20]] });                     // G3 for Ada, later reversed
            return { S, G2, G3, G4, P };
        });
    });
    after(async () => { await school.drop(); });

    const G1 = () => W.S.guardian.id;

    describe("the list", () => {
        it("G1 sees what they paid (any state), plus CONFIRMED/REVERSED payments by others that cover Ada; never G3's pending or Dayo-only payments", () => school.run(async () => {
            const { P } = W;
            assert.deepEqual(ids(await list(G1())), ids([{ id: P.own }, { id: P.byOther }, { id: P.ownPend }, { id: P.mixedOwn }, { id: P.reversed }]));
        }));
        it("a payment by someone else shows only the share for G1's child, and none of the payer's private details", () => school.run(async () => {
            const row = (await list(G1())).find(r => r.id === W.P.byOther);
            assert.equal(row.amountKobo, 30); assert.equal(row.partial, true); assert.equal(row.isPayer, false);
            assert.equal(row.guardianId, null); assert.equal(row.reference, null); assert.equal(row.unallocatedKobo, null);
            assert.equal(row.receiptNumber, "RCT-oth");
        }));
        it("a payment G1 made keeps the whole amount, even when part of it was for another family's child", () => school.run(async () => {
            const row = (await list(G1())).find(r => r.id === W.P.mixedOwn);
            assert.equal(row.amountKobo, 100); assert.equal(row.isPayer, true); assert.equal(row.partial, false); assert.equal(row.reference, "REF-mix");
        }));
        it("a reversed payment for G1's child is still listed, marked REVERSED", () => school.run(async () => {
            const row = (await list(G1())).find(r => r.id === W.P.reversed);
            assert.equal(row.status, "REVERSED"); assert.equal(row.amountKobo, 20);
        }));
        it("the second parent (G2) sees Ada's payments too, but only a share of the mixed ones", () => school.run(async () => {
            const rows = await list(W.G2.id);
            assert.deepEqual(ids(rows), ids([{ id: W.P.own }, { id: W.P.byOther }, { id: W.P.mixedOwn }, { id: W.P.reversed }]));
            assert.equal(rows.find(r => r.id === W.P.mixedOwn).amountKobo, 40, "only Ada's part of what G1 paid");
            assert.equal(rows.find(r => r.id === W.P.mixedOwn).payerName, "Gina Parent");
        }));
        it("another family (G3) sees its own and what covers Dayo, and nothing about Ada alone", () => school.run(async () => {
            const rows = await list(W.G3.id);
            assert.deepEqual(ids(rows), ids([{ id: W.P.byOther }, { id: W.P.otherPend }, { id: W.P.otherOnly }, { id: W.P.mixedOwn }, { id: W.P.reversed }]));
            assert.equal(rows.find(r => r.id === W.P.mixedOwn).amountKobo, 60);
            assert.ok(!rows.some(r => r.id === W.P.own || r.id === W.P.ownPend), "G1's payments for Ada alone are not G3's");
        }));
        it("a guardian linked to nobody sees nothing", () => school.run(async () => {
            assert.deepEqual(await list(W.G4.id), []);
        }));
        it("filters narrow, never widen: someone else's child gives nothing; the payer / branch filters are ignored", () => school.run(async () => {
            assert.deepEqual(await list(G1(), { studentId: W.S.s4.id }), [], "Dayo is not G1's child");
            assert.deepEqual(ids(await list(G1(), { studentId: W.S.s1.id })), ids([{ id: W.P.own }, { id: W.P.byOther }, { id: W.P.ownPend }, { id: W.P.mixedOwn }, { id: W.P.reversed }]));
            assert.deepEqual(ids(await list(G1(), { status: "PENDING" })), [W.P.ownPend], "G3's pending attempt never appears");
            assert.deepEqual(ids(await list(G1(), { guardianId: W.G3.id })), ids(await list(G1())), "asking for another payer changes nothing");
        }));
        it("when the link to the child is removed, the other people's payments for that child disappear; own ones stay", () => school.run(async () => {
            const link = await db().studentGuardian.findFirst({ where: { guardianId: G1(), studentId: W.S.s1.id } });
            await db().studentGuardian.delete({ where: { id: link.id } });
            try {
                assert.deepEqual(ids(await list(G1())), ids([{ id: W.P.own }, { id: W.P.ownPend }, { id: W.P.mixedOwn }]));
            } finally { await db().studentGuardian.create({ data: { guardianId: G1(), studentId: W.S.s1.id, relation: "mother", isPrimary: false } }); }
        }));
    });

    describe("the receipt", () => {
        it("the payer gets the whole receipt, with their own phone and the reference", () => school.run(async () => {
            const r = await receipt(W.P.own, G1());
            assert.equal(r.amountKobo, "100"); assert.equal(r.partial, false); assert.equal(r.reference, "REF-own"); assert.equal(r.payer.phone, "0800Gina");
            assert.equal(r.lines.length, 1); assert.equal(r.otherStudents, null); assert.equal(r.status, "CONFIRMED");
        }));
        it("someone else's payment: only G1's child's line and share; no other child, no payer phone, no reference", () => school.run(async () => {
            const r = await receipt(W.P.byOther, G1());
            assert.equal(r.amountKobo, "30"); assert.equal(r.partial, true);
            assert.deepEqual(r.lines.map((l: any) => l.studentName), ["Ada Pupil"]);
            assert.equal(r.payer.phone, null); assert.equal(r.reference, null); assert.equal(r.otherStudents, null);
            const text = JSON.stringify(r);
            for (const secret of ["Dayo", "INV-oth-Dayo", "0800Tolu", "REF-oth"]) assert.ok(!text.includes(secret), `leaked ${secret}`);
        }));
        it("a payment G1 made that also covered another family's child: full total, that child only as one anonymous amount", () => school.run(async () => {
            const r = await receipt(W.P.mixedOwn, G1());
            assert.equal(r.amountKobo, "100"); assert.deepEqual(r.lines.map((l: any) => l.studentName), ["Ada Pupil"]);
            assert.deepEqual(r.otherStudents, { amountKobo: "60" });
            const text = JSON.stringify(r);
            for (const secret of ["Dayo", "INV-mix-Dayo"]) assert.ok(!text.includes(secret), `leaked ${secret}`);
        }));
        it("the second parent can open the receipt for their child, as a non-payer", () => school.run(async () => {
            const r = await receipt(W.P.own, W.G2.id);
            assert.equal(r.amountKobo, "100"); assert.equal(r.partial, true); assert.equal(r.payer.phone, null); assert.equal(r.reference, null);
        }));
        it("a reversed payment's receipt is available and says REVERSED", () => school.run(async () => {
            assert.equal((await receipt(W.P.reversed, G1())).status, "REVERSED");
        }));
        it("not found, the same way, for: another family's payment, a pending payment (no receipt), a guardian with no link, and an id that does not exist", () => school.run(async () => {
            await assert.rejects(receipt(W.P.otherOnly, G1()), notFound);
            await assert.rejects(receipt(W.P.otherPend, G1()), notFound);
            await assert.rejects(receipt(W.P.own, W.G4.id), notFound);
            await assert.rejects(receipt("00000000-0000-4000-8000-000000000000", G1()), notFound);
        }));
        it("the answer for 'not yours' and 'does not exist' is identical (nothing is confirmed)", () => school.run(async () => {
            const a: any = await receipt(W.P.otherOnly, G1()).catch(e => e);
            const b: any = await receipt("00000000-0000-4000-8000-000000000000", G1()).catch(e => e);
            assert.equal(a.message, b.message); assert.equal(a.statusCode, b.statusCode); assert.equal(a.code, b.code);
        }));
    });
});
