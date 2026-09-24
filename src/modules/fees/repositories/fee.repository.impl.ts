import { Prisma } from "../../../generated/tenant";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import {
    PaginateParams,
    PaginatedResult,
} from "../../../infrastructure/repository/base.repository";
import { InvoiceStatus } from "../../../generated/tenant";
import { FeeTypeMapper } from "../mappers/fee.mapper";
import { FeeTypeEntity } from "../domain/fee.entity";
import { EnrichedInvoice, FeeInvoiceItemInput } from "../types/fee.types";
import { IFeeRepository } from "./fee.repository";

export class FeeRepositoryImpl implements IFeeRepository {
    private readonly feeTypeMapper: FeeTypeMapper;

    private get prisma() {
        return getTenantClient();
    }

    constructor({ feeTypeMapper }: { feeTypeMapper: FeeTypeMapper }) {
        this.feeTypeMapper = feeTypeMapper;
    }

    async findFeeTypeById(id: string): Promise<FeeTypeEntity | null> {
        const raw = await this.prisma.feeType.findUnique({
            where: { id },
        });

        return raw ? this.feeTypeMapper.toDomain(raw) : null;
    }

    async findFeeTypeByName(name: string): Promise<FeeTypeEntity | null> {
        const raw = await this.prisma.feeType.findFirst({
            where: { name },
        });

        return raw ? this.feeTypeMapper.toDomain(raw) : null;
    }

    async findAllFeeTypes(): Promise<FeeTypeEntity[]> {
        const raws = await this.prisma.feeType.findMany({
            orderBy: { name: "asc" },
        });

        return raws.map((r) => this.feeTypeMapper.toDomain(r));
    }

    async createFeeType(
        data: Prisma.FeeTypeUncheckedCreateInput,
    ): Promise<FeeTypeEntity> {
        const raw = await this.prisma.feeType.create({
            data,
        });

        return this.feeTypeMapper.toDomain(raw);
    }

    async updateFeeType(
        id: string,
        data: Record<string, any>,
    ): Promise<FeeTypeEntity> {
        const raw = await this.prisma.feeType.update({
            where: { id },
            data,
        });

        return this.feeTypeMapper.toDomain(raw);
    }

    // FeeRepositoryImpl
    async deleteFeeType(id: string): Promise<void> {
        await this.prisma.feeType.update({ where: { id }, data: { isActive: false } });
    }

    async createInvoice(
        studentId: string,
        termId: string,
        items: FeeInvoiceItemInput[],
        dueDate?: Date,
        note?: string,
    ): Promise<EnrichedInvoice> {
        const invoice = await this.prisma.feeInvoice.create({
            data: {
                studentId,
                termId,
                dueDate,
                note,
                items: {
                    create: items.map((i) => ({
                        feeTypeId: i.feeTypeId,
                        amountKobo: i.amountKobo,
                    })),
                },
            },
        });

        // Find all guardians linked to this student
        const guardians = await this.prisma.studentGuardian.findMany({
            where: {
                studentId,
            },
            select: {
                guardianId: true,
            },
        });

        // Notify guardians that a new invoice has been created
        if (guardians.length > 0) {
            const notification = await this.prisma.schoolNotification.create({
                data: {
                    title: "New fee invoice",
                    message:
                        "A new fee invoice has been issued for your child. Please log in to view it.",
                    type: "fee_invoice",
                    targetType: "GUARDIAN",
                    sentById: "SYSTEM_INVOICE_ISSUED",
                    sentAt: new Date(),
                },
            });

            await this.prisma.schoolNotificationRecipient.createMany({
                data: guardians.map((guardian) => ({
                    notificationId: notification.id,
                    guardianId: guardian.guardianId,
                    channel: "IN_APP",
                    status: "SENT",
                })),
            });
        }

        return this.findInvoiceByIdEnriched(
            invoice.id,
        ) as Promise<EnrichedInvoice>;
    }


    async updateInvoiceFields(
        id: string,
        data: Record<string, any>,
    ): Promise<void> {
        await this.prisma.feeInvoice.update({
            where: { id },
            data,
        });
    }

    async addInvoiceItem(
        invoiceId: string,
        item: FeeInvoiceItemInput,
    ): Promise<EnrichedInvoice> {
        await this.prisma.feeInvoiceItem.create({
            data: {
                feeInvoiceId: invoiceId,
                feeTypeId: item.feeTypeId,
                amountKobo: item.amountKobo,
            },
        });

        await this.recalculateInvoiceStatus(invoiceId);

        return this.findInvoiceByIdEnriched(
            invoiceId,
        ) as Promise<EnrichedInvoice>;
    }

    async findInvoiceByIdEnriched(
        id: string,
    ): Promise<EnrichedInvoice | null> {
        const raw = await this.prisma.feeInvoice.findUnique({
            where: { id },
            include: {
                student: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
                term: {
                    select: {
                        name: true,
                    },
                },
                items: {
                    include: {
                        feeType: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                payments: {
                    where: { status: "success" },
                    select: {
                        amountKobo: true,
                    },
                },
            },
        });

        if (!raw) return null;

        return await this.mapEnriched(raw);
    }

    async findInvoiceByStudentAndTerm(
        studentId: string,
        termId: string,
    ): Promise<EnrichedInvoice | null> {
        const raw = await this.prisma.feeInvoice.findUnique({
            where: {
                studentId_termId: {
                    studentId,
                    termId,
                },
            },
            include: {
                student: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
                term: {
                    select: {
                        name: true,
                    },
                },
                items: {
                    include: {
                        feeType: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                payments: {
                    where: { status: "success" },
                    select: {
                        amountKobo: true,
                    },
                },
            },
        });

        return raw ? await this.mapEnriched(raw) : null;
    }

    async paginateInvoicesEnriched(
        where: Record<string, any>,
        skip = 0,
        take = 20,
    ): Promise<{ data: EnrichedInvoice[]; total: number }> {
        const [raws, total] = await Promise.all([
            this.prisma.feeInvoice.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "desc" },
                include: {
                    student: {
                        select: {
                            firstName: true,
                            lastName: true,
                        },
                    },
                    term: {
                        select: {
                            name: true,
                        },
                    },
                    items: {
                        include: {
                            feeType: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                    },
                    payments: {
                        where: { status: "success" },
                        select: {
                            amountKobo: true,
                        },
                    },
                },
            }),

            this.prisma.feeInvoice.count({
                where,
            }),
        ]);

        const data = await Promise.all(
            raws.map((raw) => this.mapEnriched(raw)),
        );

        return {
            data,
            total,
        };
    }

    async findDefaultersSummaryByTerm(termId: string): Promise<
        Array<{
            studentId: string;
            studentName: string;
            totalOwedKobo: number;
            invoiceCount: number;
        }>
    > {
        const invoices = await this.prisma.feeInvoice.findMany({
            where: {
                termId,
                status: {
                    in: ["unpaid", "partial"],
                },
            },
            include: {
                student: {
                    select: {
                        firstName: true,
                        lastName: true,
                    },
                },
                items: true,
                payments: {
                    where: { status: "success" },
                    select: {
                        amountKobo: true,
                    },
                },
            },
        });

        const byStudent = new Map<
            string,
            {
                studentName: string;
                totalOwedKobo: number;
                invoiceCount: number;
            }
        >();

        for (const inv of invoices) {
            const subtotal =
                inv.items.reduce(
                    (s, i) => s + i.amountKobo,
                    0,
                ) - inv.discountKobo;

            const paid = inv.payments.reduce(
                (s, p) => s + p.amountKobo,
                0,
            );

            const balance = Math.max(subtotal - paid, 0);

            if (balance <= 0) continue;

            const existing = byStudent.get(inv.studentId);

            const studentName = `${inv.student.firstName} ${inv.student.lastName}`;

            if (existing) {
                existing.totalOwedKobo += balance;
                existing.invoiceCount += 1;
            } else {
                byStudent.set(inv.studentId, {
                    studentName,
                    totalOwedKobo: balance,
                    invoiceCount: 1,
                });
            }
        }

        return Array.from(byStudent.entries())
            .map(([studentId, v]) => ({
                studentId,
                ...v,
            }))
            .sort(
                (a, b) =>
                    b.totalOwedKobo - a.totalOwedKobo,
            );
    }

    async recalculateInvoiceStatus(
        invoiceId: string,
    ): Promise<void> {
        const raw = await this.prisma.feeInvoice.findUnique({
            where: { id: invoiceId },
            include: {
                items: true,
                payments: {
                    where: { status: "success" },
                    select: {
                        amountKobo: true,
                    },
                },
            },
        });

        if (!raw) return;

        const subtotal =
            raw.items.reduce(
                (s, i) => s + i.amountKobo,
                0,
            ) - raw.discountKobo;

        const paid = raw.payments.reduce(
            (s, p) => s + p.amountKobo,
            0,
        );

        let status: InvoiceStatus;

        if (paid <= 0) {
            status = "unpaid";
        } else if (paid < subtotal) {
            status = "partial";
        } else {
            status = "paid";
        }

        await this.prisma.feeInvoice.update({
            where: { id: invoiceId },
            data: { status },
        });
    }

    private async mapEnriched(
        raw: any,
    ): Promise<EnrichedInvoice> {
        /**
         * Find the student's enrolment for the SAME TERM
         * as the invoice.
         *
         * This prevents an old invoice from showing the
         * student's current class after they have changed classes.
         */
        const enrolment =
            await this.prisma.enrolment.findFirst({
                where: {
                    studentId: raw.studentId,
                    termId: raw.termId,
                    status: "active",
                },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

        const subtotalKobo =
            raw.items.reduce(
                (s: number, i: any) =>
                    s + i.amountKobo,
                0,
            ) - raw.discountKobo;

        const paidKobo =
            raw.payments.reduce(
                (s: number, p: any) =>
                    s + p.amountKobo,
                0,
            );

        const balanceKobo = Math.max(
            subtotalKobo - paidKobo,
            0,
        );

        return {
            id: raw.id,
            studentId: raw.studentId,
            studentName: `${raw.student.firstName} ${raw.student.lastName}`,

            classId: enrolment?.classId ?? null,
            className: enrolment?.class?.name ?? null,

            termId: raw.termId,
            termName: raw.term.name,

            discountKobo: raw.discountKobo,
            subtotalKobo,
            paidKobo,
            balanceKobo,

            status: raw.status,
            dueDate: raw.dueDate,
            note: raw.note,

            items: raw.items.map((i: any) => ({
                id: i.id,
                feeTypeId: i.feeTypeId,
                feeTypeName: i.feeType.name,
                amountKobo: i.amountKobo,
            })),

            createdAt: raw.createdAt,
        };
    }

    async findInvoiceItemById(id: string) {
        return this.prisma.feeInvoiceItem.findUnique({
            where: { id },
        });
    }

    async updateInvoiceItem(
        id: string,
        amountKobo: number,
    ) {
        await this.prisma.feeInvoiceItem.update({
            where: { id },
            data: { amountKobo },
        });
    }

    async deleteInvoiceItem(id: string) {
        await this.prisma.feeInvoiceItem.delete({
            where: { id },
        });
    }

    async findPaymentsByInvoiceId(invoiceId: string) {
        return this.prisma.payment.findMany({
            where:   { feeInvoiceId: invoiceId },
            orderBy: { createdAt: "desc" },
        });
    }

    async findGuardianLinksByStudent(studentId: string) {
        return this.prisma.studentGuardian.findMany({
            where: {
                studentId,
            },
            select: {
                guardianId: true,
                guardian: {
                    select: {
                        email: true,
                        firstName: true,
                    },
                },
            },
        });
    }

}
