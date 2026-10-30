import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { ExpenseMapper } from "./mappers/expense.mapper";
import { VendorMapper } from "./mappers/vendor.mapper";
import { BudgetMapper, RecurringMapper } from "./mappers/budget.mapper";
import { ExpenseRepositoryImpl } from "./repositories/expense.repository.impl";
import { VendorRepositoryImpl } from "./repositories/vendor.repository.impl";
import { BudgetRepositoryImpl } from "./repositories/budget.repository.impl";
import { RecurringRepositoryImpl } from "./repositories/recurring.repository.impl";
import { ExpenseReportRepositoryImpl } from "./repositories/expense-report.repository.impl";
import { BudgetCheckService } from "./services/budget-check.service";
import { ExpenseApprovalService } from "./services/expense-approval.service";
import { ListVendorsUseCase, GetVendorUseCase, CreateVendorUseCase, UpdateVendorUseCase, SetVendorActiveUseCase, DeleteVendorUseCase } from "./usecases/vendor.usecases";
import { ListExpensesUseCase, GetExpenseUseCase } from "./usecases/expense-queries.usecases";
import { CreateExpenseUseCase, UpdateExpenseUseCase, DeleteExpenseUseCase, SubmitExpenseUseCase, ApproveExpenseUseCase, RejectExpenseUseCase, VoidExpenseUseCase } from "./usecases/expense-commands.usecases";
import { PayExpenseUseCase, ReverseExpensePaymentUseCase } from "./usecases/expense-payments.usecases";
import { ListBudgetsUseCase, GetBudgetUseCase, CreateBudgetUseCase, UpdateBudgetUseCase, SetBudgetLinesUseCase, SetBudgetStatusUseCase, DeleteBudgetUseCase, BudgetVsActualUseCase } from "./usecases/budget.usecases";
import {
    ListRecurringUseCase, GetRecurringUseCase, CreateRecurringUseCase, UpdateRecurringUseCase, SetRecurringActiveUseCase, DeleteRecurringUseCase,
    RunRecurringExpensesUseCase, RunRecurringForAllSchoolsUseCase,
} from "./usecases/recurring.usecases";
import { ExpenseReportUseCase, CreditorsReportUseCase, PettyCashUseCase } from "./usecases/expense-report.usecases";
import { ExpenseController } from "./controllers/expense.controller";
import { VendorController } from "./controllers/vendor.controller";
import { BudgetController } from "./controllers/budget.controller";
import { RecurringController } from "./controllers/recurring.controller";

/*
| Requires: the ledger module (postingService, ledgerAccountRepository, cashBookUseCase), the shared numberSequenceService and encryptionService,
| and the audit module (auditService).
*/
export const registerExpenses = (container: AwilixContainer): void => {
    container.register({
        expenseMapper:   asClass(ExpenseMapper).singleton(),
        vendorMapper:    asClass(VendorMapper).singleton(),
        budgetMapper:    asClass(BudgetMapper).singleton(),
        recurringMapper: asClass(RecurringMapper).singleton(),

        expenseRepository:       asClass(ExpenseRepositoryImpl).scoped(),
        vendorRepository:        asClass(VendorRepositoryImpl).scoped(),
        budgetRepository:        asClass(BudgetRepositoryImpl).scoped(),
        recurringRepository:     asClass(RecurringRepositoryImpl).scoped(),
        expenseReportRepository: asClass(ExpenseReportRepositoryImpl).scoped(),

        budgetCheckService:      asClass(BudgetCheckService).scoped(),
        expenseApprovalService:  asClass(ExpenseApprovalService).scoped(),

        listVendorsUseCase:     asClass(ListVendorsUseCase).scoped(),
        getVendorUseCase:       asClass(GetVendorUseCase).scoped(),
        createVendorUseCase:    asClass(CreateVendorUseCase).scoped(),
        updateVendorUseCase:    asClass(UpdateVendorUseCase).scoped(),
        setVendorActiveUseCase: asClass(SetVendorActiveUseCase).scoped(),
        deleteVendorUseCase:    asClass(DeleteVendorUseCase).scoped(),
        vendorController:       asClass(VendorController).scoped(),

        listExpensesUseCase:   asClass(ListExpensesUseCase).scoped(),
        getExpenseUseCase:     asClass(GetExpenseUseCase).scoped(),
        createExpenseUseCase:  asClass(CreateExpenseUseCase).scoped(),
        updateExpenseUseCase:  asClass(UpdateExpenseUseCase).scoped(),
        deleteExpenseUseCase:  asClass(DeleteExpenseUseCase).scoped(),
        submitExpenseUseCase:  asClass(SubmitExpenseUseCase).scoped(),
        approveExpenseUseCase: asClass(ApproveExpenseUseCase).scoped(),
        rejectExpenseUseCase:  asClass(RejectExpenseUseCase).scoped(),
        voidExpenseUseCase:    asClass(VoidExpenseUseCase).scoped(),
        payExpenseUseCase:     asClass(PayExpenseUseCase).scoped(),
        reverseExpensePaymentUseCase: asClass(ReverseExpensePaymentUseCase).scoped(),
        expenseReportUseCase:  asClass(ExpenseReportUseCase).scoped(),
        creditorsReportUseCase: asClass(CreditorsReportUseCase).scoped(),
        pettyCashUseCase:      asClass(PettyCashUseCase).scoped(),
        expenseController:     asClass(ExpenseController).scoped(),

        listBudgetsUseCase:     asClass(ListBudgetsUseCase).scoped(),
        getBudgetUseCase:       asClass(GetBudgetUseCase).scoped(),
        createBudgetUseCase:    asClass(CreateBudgetUseCase).scoped(),
        updateBudgetUseCase:    asClass(UpdateBudgetUseCase).scoped(),
        setBudgetLinesUseCase:  asClass(SetBudgetLinesUseCase).scoped(),
        setBudgetStatusUseCase: asClass(SetBudgetStatusUseCase).scoped(),
        deleteBudgetUseCase:    asClass(DeleteBudgetUseCase).scoped(),
        budgetVsActualUseCase:  asClass(BudgetVsActualUseCase).scoped(),
        budgetController:       asClass(BudgetController).scoped(),

        listRecurringUseCase:        asClass(ListRecurringUseCase).scoped(),
        getRecurringUseCase:         asClass(GetRecurringUseCase).scoped(),
        createRecurringUseCase:      asClass(CreateRecurringUseCase).scoped(),
        updateRecurringUseCase:      asClass(UpdateRecurringUseCase).scoped(),
        setRecurringActiveUseCase:   asClass(SetRecurringActiveUseCase).scoped(),
        deleteRecurringUseCase:      asClass(DeleteRecurringUseCase).scoped(),
        runRecurringExpensesUseCase: asClass(RunRecurringExpensesUseCase).scoped(),
        runRecurringForAllSchoolsUseCase: asClass(RunRecurringForAllSchoolsUseCase).scoped(),
        recurringController:         asClass(RecurringController).scoped(),
    });
};
