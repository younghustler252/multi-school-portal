/*
| An in-memory stand-in for the Prisma client, just rich enough for the billing engine and lifecycle job, with the two properties the
| concurrency tests need:
|  - every row operation yields to the event loop, so two requests really interleave;
|  - `SELECT ... FOR UPDATE` on Subscription / SubscriptionInvoice is a real mutex held until the surrounding $transaction ends
|    (`world.locksOff = true` removes it: the behaviour before REM-067/068);
|  - the unique rules the code relies on: PaymentAttempt.reference, the partial index PaymentAttempt_one_pending_checkout
|    (checkoutKey while status = pending) and CapturedPaymentException.attemptId.
*/
import { AsyncLocalStorage } from "node:async_hooks";
import { BillingEngine } from "../../../src/modules/subscriptions/services/billing-engine.service";
import { BillingLifecycleService } from "../../../src/modules/subscriptions/services/billing-lifecycle.service";

const yieldNow = () => new Promise<void>(r => setImmediate(r));
const DAY = 86_400_000;
export const T0 = new Date("2026-11-01T00:00:00Z");
export const day = (n: number) => new Date(T0.getTime() + n * DAY);

class Mutex {
    private chain: Promise<void> = Promise.resolve();
    acquire(): Promise<() => void> {
        let release!: () => void; const next = new Promise<void>(r => (release = r));
        const ready = this.chain.then(() => release); this.chain = this.chain.then(() => next); return ready;
    }
}

type Row = Record<string, any>;
const RELATIONS: Record<string, Record<string, { table: string; fk: string }>> = {
    subscriptionInvoice: { subscription: { table: "subscription", fk: "subscriptionId" }, plan: { table: "plan", fk: "planId" } },
    subscription: { plan: { table: "plan", fk: "planId" } },
    paymentAttempt: { invoice: { table: "subscriptionInvoice", fk: "invoiceId" } },
};

export function billingWorld(o: { locksOff?: boolean } = {}) {
    const w: any = { locksOff: !!o.locksOff, calls: { initialize: 0 }, audits: [] as any[], notices: [] as any[] };
    const tables: Record<string, Row[]> = { plan: [], subscription: [], subscriptionInvoice: [], paymentAttempt: [], paymentMethod: [], capturedPaymentException: [], coupon: [], platformSettings: [{ subscriptionGracePeriodDays: 7 }] };
    let seq = 0; w.tables = tables;
    const als = new AsyncLocalStorage<{ release: Array<() => void>; held: Set<string> }>();
    const locks = new Map<string, Mutex>();

    const cmp = (v: any, c: any): boolean => {
        if (c === null) return v === null || v === undefined;
        if (c instanceof Date) return v instanceof Date && v.getTime() === c.getTime();
        if (typeof c === "object" && c !== null) {
            if ("not" in c) return c.not === null ? !(v === null || v === undefined) : !cmp(v, c.not);
            if ("in" in c) return c.in.includes(v);
            const t = (x: any) => (x instanceof Date ? x.getTime() : x);
            if ("lt" in c && !(t(v) < t(c.lt))) return false; if ("lte" in c && !(t(v) <= t(c.lte))) return false;
            if ("gt" in c && !(t(v) > t(c.gt))) return false; if ("gte" in c && !(t(v) >= t(c.gte))) return false;
            return ["lt", "lte", "gt", "gte"].some(k => k in c);
        }
        return v === c;
    };
    const match = (table: string, row: Row, where: Row = {}): boolean => Object.entries(where).every(([k, c]) => {
        if (k === "OR") return (c as Row[]).some(w2 => match(table, row, w2));
        if (k === "AND") return (c as Row[]).every(w2 => match(table, row, w2));
        const rel = RELATIONS[table]?.[k];
        if (rel && typeof c === "object" && c !== null) { const r = tables[rel.table].find(x => x.id === row[rel.fk]); return !!r && match(rel.table, r, c as Row); }
        return cmp(row[k], c);
    });
    const withIncludes = (table: string, row: Row | undefined, include?: Row) => {
        if (!row) return row; if (!include) return { ...row };
        const out: Row = { ...row };
        for (const k of Object.keys(include)) { const rel = RELATIONS[table]?.[k]; if (rel) { const r = tables[rel.table].find(x => x.id === row[rel.fk]); out[k] = r ? { ...r } : null; } }
        return out;
    };
    const unique = (table: string, rows: Row[], cand: Row, skip?: Row) => {
        const others = rows.filter(r => r !== skip);
        const dup = (msg: string) => Object.assign(new Error(`Unique constraint failed: ${msg}`), { code: "P2002" });
        if (table === "paymentAttempt") {
            if (others.some(r => r.reference === cand.reference)) throw dup("reference");
            if (cand.checkoutKey && cand.status === "pending" && others.some(r => r.checkoutKey === cand.checkoutKey && r.status === "pending")) throw dup("PaymentAttempt_one_pending_checkout");
        }
        if (table === "capturedPaymentException" && others.some(r => r.attemptId === cand.attemptId)) throw dup("attemptId");
    };
    const model = (table: string) => {
        const rows = tables[table];
        const apply = (row: Row, data: Row) => { for (const [k, v] of Object.entries(data)) row[k] = v; };
        const m: any = {
            async findUnique(a: any) { await yieldNow(); return withIncludes(table, rows.find(r => match(table, r, a.where)), a.include) ?? null; },
            async findFirst(a: any = {}) { await yieldNow(); return withIncludes(table, rows.find(r => match(table, r, a.where)), a.include) ?? null; },
            async findMany(a: any = {}) { await yieldNow(); const f = rows.filter(r => match(table, r, a.where)); return (a.take ? f.slice(0, a.take) : f).map(r => withIncludes(table, r, a.include)); },
            async count(a: any = {}) { await yieldNow(); return rows.filter(r => match(table, r, a.where)).length; },
            async create(a: any) {
                await yieldNow();
                const row: Row = { id: a.data.id ?? `${table}-${++seq}`, createdAt: new Date(), status: table === "paymentAttempt" ? "pending" : undefined, ...a.data };
                unique(table, rows, row); rows.push(row); return { ...row };
            },
            async createMany(a: any) {
                await yieldNow(); let count = 0;
                for (const d of a.data) { const row = { id: `${table}-${++seq}`, createdAt: new Date(), status: "open", ...d }; try { unique(table, rows, row); } catch (e) { if (a.skipDuplicates) continue; throw e; } rows.push(row); count++; }
                return { count };
            },
            async update(a: any) { await yieldNow(); const r = rows.find(x => match(table, x, a.where)); if (!r) throw new Error(`${table} not found`); const next = { ...r, ...a.data }; unique(table, rows, next, r); apply(r, a.data); return { ...r }; },
            async updateMany(a: any) { await yieldNow(); const hit = rows.filter(r => match(table, r, a.where)); for (const r of hit) apply(r, a.data); return { count: hit.length }; },
            async aggregate() { await yieldNow(); return { _count: { _all: rows.length }, _sum: { amountKobo: 0 } }; },
        };
        m.findUniqueOrThrow = async (a: any) => { const r = await m.findUnique(a); if (!r) throw new Error(`${table} not found`); return r; };
        return m;
    };
    const client: any = { ...Object.fromEntries(Object.keys(tables).map(t => [t, model(t)])) };
    client.subscriptionInvoiceItem = { aggregate: async () => ({ _sum: { amountKobo: 0 } }) };
    client.$queryRaw = async (strings: TemplateStringsArray, ...values: any[]) => {
        const sql = strings.join("?"); const store = als.getStore();
        const t = /FROM "(\w+)"/.exec(sql)?.[1]; const forUpdate = /FOR UPDATE/.test(sql);
        await yieldNow();
        if (forUpdate && store && !w.locksOff && t) {
            const key = `${t}:${values[0]}`;
            if (!store.held.has(key)) { if (!locks.has(key)) locks.set(key, new Mutex()); store.release.push(await locks.get(key)!.acquire()); store.held.add(key); }
        }
        return [{ id: values[0] }];
    };
    // The coupon use counter: ONE conditional UPDATE, atomic like a single SQL statement (the check and the increment happen together)
    client.$executeRaw = async (strings: TemplateStringsArray, ...values: any[]) => {
        await yieldNow();
        if (/UPDATE "Coupon" SET "usedCount"/.test(strings.join("?"))) {
            const c = tables.coupon.find(r => r.id === values[0]);
            if (!c || (c.maxUses !== null && c.usedCount >= c.maxUses)) return 0;
            c.usedCount++; return 1;
        }
        return 0;
    };
    client.$transaction = async (fn: any) => {
        const store = { release: [] as Array<() => void>, held: new Set<string>() };
        try { return await als.run(store, () => fn(client)); } finally { store.release.reverse().forEach(r => r()); }
    };

    // ---- the engine and the lifecycle job over it
    const provider: any = {
        async initializeTransaction(i: any) { w.calls.initialize++; await yieldNow(); if (w.initFails) throw new Error("provider down"); return { authorizationUrl: `https://pay.example/${i.reference}`, reference: i.reference }; },
        async verifyTransaction(ref: string) { const r = w.verify?.[ref]; if (!r) throw Object.assign(new Error("not found"), { definitive: false }); return r; },
    };
    const deps: any = {
        prismaClient: client, paymentProvider: provider, encryptionService: { encrypt: (x: string) => x, decrypt: (x: string) => x },
        billingNotifier: { async send(...a: any[]) { w.notices.push(a); }, async sendOnce() { return true; } },
        auditService: { async log(p: any) { w.audits.push(p); } }, entitlementsService: { invalidate() {} },
        invoiceService: {}, usageService: {},
    };
    const engine = new BillingEngine(deps); deps.billingEngine = engine;
    const lifecycle = new BillingLifecycleService(deps);
    Object.assign(w, { client, engine, lifecycle, deps });

    // ---- seed
    tables.plan.push({ id: "free", name: "Free", systemKey: "free", monthlyPriceKobo: 0, yearlyPriceKobo: 0 }, { id: "pro", name: "Pro", systemKey: null, monthlyPriceKobo: 1_000_000, yearlyPriceKobo: 10_000_000 }, { id: "max", name: "Max", systemKey: null, monthlyPriceKobo: 2_000_000, yearlyPriceKobo: 20_000_000 });
    tables.subscription.push({ id: "sub1", schoolId: "sc1", planId: "pro", status: "active", billingCycle: "monthly", currentPeriodStart: day(-30), currentPeriodEnd: day(0), nextBillingDate: day(0), autoRenew: false, paymentMethodId: null, cancelAtPeriodEnd: false, scheduledDowngradePlanId: null, billingAnchorDay: 1, couponId: null, lapsedPlanId: null, failedBillingCount: 0, trialEndsAt: null, cancelledAt: null });
    w.invoice = (over: Row = {}) => { const row = { id: `inv-${++seq}`, number: `INV-${seq}`, subscriptionId: "sub1", schoolId: "sc1", planId: "pro", billingCycle: "monthly", reason: "renewal", status: "open", totalKobo: 1_000_000, amountPaidKobo: 0, periodStart: day(0), periodEnd: day(30), dueDate: day(0), createdAt: day(-3), paidAt: null, attemptCount: 0, nextAttemptAt: null, couponId: null, ...over }; tables.subscriptionInvoice.push(row); return row; };
    w.attempt = (inv: Row, over: Row = {}) => { const row = { id: `att-${++seq}`, invoiceId: inv.id, reference: `${inv.number}-C${seq}`, amountKobo: inv.totalKobo - inv.amountPaidKobo, status: "pending", method: "checkout", createdAt: new Date(), checkoutKey: null, authorizationUrl: null, ...over }; tables.paymentAttempt.push(row); return row; };
    w.coupon = (over: Row = {}) => { const row = { id: `cp-${++seq}`, maxUses: 1, usedCount: 0, ...over }; tables.coupon.push(row); return row; };
    w.paid = (att: Row, over: Partial<{ amountKobo: number; currency: string }> = {}) => ({ status: "success", reference: att.reference, amountKobo: att.amountKobo, currency: "NGN", paidAt: new Date(), channel: "card", customerEmail: "a@b.c", reusable: false, ...over });
    w.sub = () => tables.subscription[0]; w.inv = (id: string) => tables.subscriptionInvoice.find(i => i.id === id)!;
    return w;
}
