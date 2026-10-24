import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { FeeInvoiceEntity, InvoiceFilters, NewInvoiceDiscount, NewInvoiceItem } from "../domain/invoice.entity";

export interface IFeeInvoiceRepository {
    findById(id: string): Promise<FeeInvoiceEntity | null>;                                               // with items, discounts and the student's name
    list(filters: InvoiceFilters, page?: number, limit?: number): Promise<PaginatedResult<FeeInvoiceEntity>>;   // without items
    draftIds(filters: InvoiceFilters): Promise<string[]>;                                                 // drafts matching, for issuing in bulk
    liveStudentsForStructure(structureId: string, studentIds: string[]): Promise<string[]>;               // students who already have an invoice from it
    createDraft(data: Record<string, any>, items: NewInvoiceItem[], discounts: NewInvoiceDiscount[]): Promise<FeeInvoiceEntity>;
    replaceDraft(id: string, version: number, data: Record<string, any>, items: NewInvoiceItem[], discounts: NewInvoiceDiscount[]): Promise<FeeInvoiceEntity | null>;   // null when it changed meanwhile
    markIssued(id: string, version: number, data: Record<string, any>): Promise<boolean>;                 // false when it changed meanwhile
    markVoid(id: string, version: number, data: Record<string, any>): Promise<boolean>;
    deleteDraft(id: string): Promise<boolean>;
    findOpenForStudents(studentIds: string[]): Promise<FeeInvoiceEntity[]>;                                // issued, balance above zero, for these students (no items)
    findManyByIds(ids: string[]): Promise<FeeInvoiceEntity[]>;                                             // no items
    applyPayment(id: string, version: number, amountKobo: bigint, status: "partial" | "paid"): Promise<boolean>;   // false when it changed meanwhile
    updateAmounts(id: string, version: number, data: { adjustmentsKobo?: bigint; discountKobo?: bigint; totalKobo: bigint; paidKobo: bigint; balanceKobo: bigint; status: "unpaid" | "partial" | "paid" | "waived" }): Promise<boolean>;   // absolute values on an issued invoice; false when it changed meanwhile
    addDiscountLine(invoiceId: string, label: string, amountKobo: bigint): Promise<void>;                    // an extra discount shown on the invoice
    lateFeeLinks(ids: string[]): Promise<{ charged: Set<string>; areLateFees: Set<string> }>;                 // which of these were already charged a late fee, and which ARE late fees
    countPayments(id: string): Promise<number>;                                                           // live allocations against it
}
