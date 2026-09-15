import { asClass }                     from "awilix";
import type { AwilixContainer }        from "awilix";
import { FeeTypeMapper } from "./mappers/fee.mapper";
import { FeeRepositoryImpl }           from "./repositories/fee.repository.impl";
import { CreateFeeTypeUseCase }        from "./usecases/create-fee-type.usecase";
import { GetFeeTypesUseCase }          from "./usecases/get-fee-types.usecase";
import { CreateInvoiceUseCase }        from "./usecases/create-invoice.usecase";
import { UpdateInvoiceUseCase } from "./usecases/update-invoice.usecase";
import { BulkCreateInvoicesUseCase }   from "./usecases/bulk-create-invoices.usecase";
import { GetInvoiceByIdUseCase } from "./usecases/get-invoice-by-id.usecase";
import { GetInvoicesUseCase }          from "./usecases/get-invoices.usecase";
import { GetDefaultersUseCase }        from "./usecases/get-defaulters.usecase";
import { UpdateInvoiceItemUseCase }        from "./usecases/update-invoice-item.usecase";
import { RemoveInvoiceItemUseCase } from "./usecases/remove-invoice-item.usecase";
import { InvoiceClassUseCase }  from "./usecases/invoice-class.usecase";
import { RecordPaymentUseCase } from "./usecases/record-payment.usecase";
import { GetMyChildrenInvoicesUseCase } from "./usecases/get-my-children-invoices.usecase";
import { GetInvoicePaymentsUseCase } from "./usecases/get-invoice-payments.usecase";
import { WaiveInvoiceUseCase } from "./usecases/waive-invoice.usecase";


import { FeeController }               from "./controllers/fee.controller";

export const registerFees = (container: AwilixContainer): void => {
    container.register({
        feeTypeMapper:             asClass(FeeTypeMapper).singleton(),
        feeRepository:             asClass(FeeRepositoryImpl).scoped(),
        createFeeTypeUseCase:      asClass(CreateFeeTypeUseCase).scoped(),
        getFeeTypesUseCase:        asClass(GetFeeTypesUseCase).scoped(),
        createInvoiceUseCase:      asClass(CreateInvoiceUseCase).scoped(),
        bulkCreateInvoicesUseCase: asClass(BulkCreateInvoicesUseCase).scoped(),
        getInvoicesUseCase:        asClass(GetInvoicesUseCase).scoped(),
        getInvoiceByIdUseCase:     asClass(GetInvoiceByIdUseCase).scoped(),
        getDefaultersUseCase:      asClass(GetDefaultersUseCase).scoped(),
        updateInvoiceUseCase:      asClass(UpdateInvoiceUseCase).scoped(),
        updateInvoiceItemUseCase:      asClass(UpdateInvoiceItemUseCase).scoped(),
        removeInvoiceItemUseCase: asClass(RemoveInvoiceItemUseCase).scoped(),
        invoiceClassUseCase:  asClass(InvoiceClassUseCase).scoped(),
        recordPaymentUseCase: asClass(RecordPaymentUseCase).scoped(),
        getMyChildrenInvoicesUseCase: asClass(GetMyChildrenInvoicesUseCase).scoped(),
        getInvoicePaymentsUseCase: asClass(GetInvoicePaymentsUseCase).scoped(),
        waiveInvoiceUseCase: asClass(WaiveInvoiceUseCase).scoped(),
        feeController:             asClass(FeeController).scoped(),
    });
};