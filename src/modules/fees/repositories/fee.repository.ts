import { FeeTypeEntity } from "../domain/fee.entity";
import { FeeInvoiceItemInput, EnrichedInvoice } from "../types/fee.types";

export interface IFeeRepository {
    // Fee Types
    findFeeTypeById(id: string): Promise<FeeTypeEntity | null>;
    findFeeTypeByName(name: string): Promise<FeeTypeEntity | null>;
    findAllFeeTypes(): Promise<FeeTypeEntity[]>;
    createFeeType(data: Record<string, any>): Promise<FeeTypeEntity>;
    updateFeeType(
        id: string,
        data: Record<string, any>,
    ): Promise<FeeTypeEntity>;
    deleteFeeType(id: string): Promise<void>;

    // Invoices
    createInvoice(
        studentId: string,
        termId: string,
        items: FeeInvoiceItemInput[],
        dueDate?: Date,
        note?: string,
    ): Promise<EnrichedInvoice>;

    updateInvoiceFields(
        id: string,
        data: Record<string, any>,
    ): Promise<void>;


    addInvoiceItem(
        invoiceId: string,
        item: FeeInvoiceItemInput,
    ): Promise<EnrichedInvoice>;

    findInvoiceByIdEnriched(
        id: string,
    ): Promise<EnrichedInvoice | null>;

    findInvoiceByStudentAndTerm(
        studentId: string,
        termId: string,
    ): Promise<EnrichedInvoice | null>;

    paginateInvoicesEnriched(
        where: Record<string, any>,
        skip?: number,
        take?: number,
    ): Promise<{
        data: EnrichedInvoice[];
        total: number;
    }>;

    findDefaultersSummaryByTerm(
        termId: string,
    ): Promise<Array<{
        studentId: string;
        studentName: string;
        totalOwedKobo: number;
        invoiceCount: number;
    }>>;

    recalculateInvoiceStatus(
        invoiceId: string,
    ): Promise<void>;

    findInvoiceItemById(id: string): Promise<any | null>;

    findPaymentsByInvoiceId(invoiceId: string): Promise<any[]>;

    updateInvoiceItem(
        id: string,
        amountKobo: number,
    ): Promise<void>;

    deleteInvoiceItem(id: string): Promise<void>;

    findGuardianLinksByStudent(studentId: string): Promise<
        Array<{
            guardianId: string;
            guardian: {
                email: string;
                firstName: string;
            };
        }>
    >;


}
