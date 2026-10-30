import { PrismaClient } from "../../../generated/public/client";
import { InvoiceNumberService } from "./invoice-number.service";
import { QuoteItem } from "./proration.service";
import { InvoiceEntity } from "../domain/subscription.entity";
import { toInvoice } from "../repositories/invoice.repository";
import { Cycle } from "../domain/billing.calendar";

interface Dependencies { prismaClient: PrismaClient; invoiceNumberService: InvoiceNumberService }

export interface CreateInvoiceArgs {
    subscriptionId: string; schoolId: string; planId: string; cycle: Cycle;
    reason: "upgrade" | "renewal" | "adjustment";
    periodStart: Date; periodEnd: Date;
    items: QuoteItem[]; subtotalKobo: number; discountKobo: number; totalKobo: number;
    couponId?: string | null; dueDate: Date; nextAttemptAt?: Date | null;
    idempotencyKey?: string; createdById?: string; note?: string;
}

export class InvoiceService {
    private readonly prisma: PrismaClient;
    private readonly numbers: InvoiceNumberService;
    constructor({ prismaClient, invoiceNumberService }: Dependencies) { this.prisma = prismaClient; this.numbers = invoiceNumberService; }

    /**
     * Creates an invoice with its line items. A repeated call with the same idempotencyKey returns the invoice
     * that already exists (so a renewal can never be invoiced twice, even if the billing job runs twice).
     */
    async create(a: CreateInvoiceArgs): Promise<{ invoice: InvoiceEntity; created: boolean }> {
        if (a.idempotencyKey) {
            const existing = await this.prisma.subscriptionInvoice.findUnique({ where: { idempotencyKey: a.idempotencyKey }, include: { items: true } });
            if (existing) return { invoice: toInvoice(existing), created: false };
        }
        const number = await this.numbers.next();
        try {
            const row = await this.prisma.subscriptionInvoice.create({
                data: {
                    number, idempotencyKey: a.idempotencyKey ?? null, subscriptionId: a.subscriptionId, schoolId: a.schoolId,
                    planId: a.planId, billingCycle: a.cycle, reason: a.reason, status: "open",
                    periodStart: a.periodStart, periodEnd: a.periodEnd, subtotalKobo: a.subtotalKobo, discountKobo: a.discountKobo,
                    totalKobo: a.totalKobo, couponId: a.couponId ?? null, dueDate: a.dueDate, nextAttemptAt: a.nextAttemptAt ?? null,
                    createdById: a.createdById ?? null, note: a.note ?? null,
                    items: { create: a.items.map(i => ({ kind: i.kind, description: i.description, amountKobo: i.amountKobo })) },
                },
                include: { items: true },
            });
            return { invoice: toInvoice(row), created: true };
        } catch (err: any) {
            if (err?.code === "P2002" && a.idempotencyKey) {      // lost a race with another run: use the winner's invoice
                const winner = await this.prisma.subscriptionInvoice.findUniqueOrThrow({ where: { idempotencyKey: a.idempotencyKey }, include: { items: true } });
                return { invoice: toInvoice(winner), created: false };
            }
            throw err;
        }
    }

    /** Voids this subscription's other open invoices (an upgrade replaces any earlier unpaid upgrade attempt). */
    async voidOpenUpgrades(subscriptionId: string): Promise<void> {
        await this.prisma.subscriptionInvoice.updateMany({
            where: { subscriptionId, status: "open", reason: "upgrade" },
            data:  { status: "void", voidedAt: new Date(), note: "Replaced by a newer request" },
        });
    }
}
