import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { ReconciliationMapper } from "./mappers/reconciliation.mapper";
import { BankStatementRepositoryImpl, BookLineRepositoryImpl, MatchRepositoryImpl, ReconciliationRepositoryImpl } from "./repositories/bank-reconciliation.repositories.impl";
import { ImportStatementUseCase, ListStatementsUseCase, DeleteStatementUseCase } from "./usecases/statement.usecases";
import {
    ListBankLinesUseCase, ListBookLinesUseCase, SuggestMatchesUseCase, AutoMatchUseCase, CreateMatchUseCase, RemoveMatchUseCase,
    ClearBookLinesUseCase, CreateEntryFromBankLineUseCase,
} from "./usecases/matching.usecases";
import {
    ReconciliationSummaryUseCase, CompleteReconciliationUseCase, ReopenReconciliationUseCase, ListReconciliationsUseCase, AccountsOverviewUseCase,
} from "./usecases/reconciliation.usecases";
import { BankReconciliationController } from "./controllers/bank-reconciliation.controller";

/*
| Requires: the ledger module (postingService, ledgerAccountRepository, financePeriodRepository), the finance settings module
| (financeSettingsService, for the matching tolerance) and the audit module.
*/
export const registerBankReconciliation = (container: AwilixContainer): void => {
    container.register({
        reconciliationMapper: asClass(ReconciliationMapper).singleton(),

        bankStatementRepository:  asClass(BankStatementRepositoryImpl).scoped(),
        bookLineRepository:       asClass(BookLineRepositoryImpl).scoped(),
        matchRepository:          asClass(MatchRepositoryImpl).scoped(),
        reconciliationRepository: asClass(ReconciliationRepositoryImpl).scoped(),

        importStatementUseCase: asClass(ImportStatementUseCase).scoped(), listStatementsUseCase: asClass(ListStatementsUseCase).scoped(),
        deleteStatementUseCase: asClass(DeleteStatementUseCase).scoped(),

        listBankLinesUseCase: asClass(ListBankLinesUseCase).scoped(), listBookLinesUseCase: asClass(ListBookLinesUseCase).scoped(),
        suggestMatchesUseCase: asClass(SuggestMatchesUseCase).scoped(), autoMatchUseCase: asClass(AutoMatchUseCase).scoped(),
        createMatchUseCase: asClass(CreateMatchUseCase).scoped(), removeMatchUseCase: asClass(RemoveMatchUseCase).scoped(),
        clearBookLinesUseCase: asClass(ClearBookLinesUseCase).scoped(), createEntryFromBankLineUseCase: asClass(CreateEntryFromBankLineUseCase).scoped(),

        reconciliationSummaryUseCase: asClass(ReconciliationSummaryUseCase).scoped(), completeReconciliationUseCase: asClass(CompleteReconciliationUseCase).scoped(),
        reopenReconciliationUseCase: asClass(ReopenReconciliationUseCase).scoped(), listReconciliationsUseCase: asClass(ListReconciliationsUseCase).scoped(),
        accountsOverviewUseCase: asClass(AccountsOverviewUseCase).scoped(),

        bankReconciliationController: asClass(BankReconciliationController).scoped(),
    });
};
