import {
    FeeTypeEntity,
    FeeInvoiceEntity,
}                        from "../domain/fee.entity";
import {
    PaginatedResult,
    PaginateParams,
}                        from "../../../infrastructure/repository/base.repository";

export interface IFeeRepository {
    // ── Fee Types ─────────────────────────────────────────────────────────
    findFeeTypeById(id: string):                     Promise<FeeTypeEntity | null>;
    findFeeTypeByName(name: string):                 Promise<FeeTypeEntity | null>;
    findAllFeeTypes():                               Promise<FeeTypeEntity[]>;
    createFeeType(data: Record<string, any>):        Promise<FeeTypeEntity>;
    updateFeeType(
        id:   string,
        data: Record<string, any>,
    ):                                               Promise<FeeTypeEntity>;
    deleteFeeType(id: string):                       Promise<void>;

    // ── Invoices ──────────────────────────────────────────────────────────
    findInvoiceById(id: string):                     Promise<FeeInvoiceEntity | null>;
    findInvoice(where: Record<string, any>):         Promise<FeeInvoiceEntity | null>;
    paginateInvoices(
        params: PaginateParams,
    ):                                               Promise<PaginatedResult<FeeInvoiceEntity>>;
    createInvoice(data: Record<string, any>):        Promise<FeeInvoiceEntity>;
    updateInvoice(
        id:   string,
        data: Record<string, any>,
    ):                                               Promise<FeeInvoiceEntity>;
    findDefaultersByTerm(termId: string):            Promise<FeeInvoiceEntity[]>;
    countInvoices(where: Record<string, any>):       Promise<number>;
}