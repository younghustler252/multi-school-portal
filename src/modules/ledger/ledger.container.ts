import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { NumberSequenceService } from "../../shared/services/number-sequence.service";
import { JournalMapper } from "./mappers/journal.mapper";
import { FinancePeriodMapper } from "./mappers/finance-period.mapper";
import { LedgerAccountMapper } from "./mappers/ledger-account.mapper";
import { LedgerReportMapper } from "./mappers/ledger-report.mapper";
import { JournalRepositoryImpl } from "./repositories/journal.repository.impl";
import { FinancePeriodRepositoryImpl } from "./repositories/finance-period.repository.impl";
import { LedgerAccountRepositoryImpl } from "./repositories/ledger-account.repository.impl";
import { LedgerReportRepositoryImpl } from "./repositories/ledger-report.repository.impl";
import { PostingService } from "./services/posting.service";
import { ListJournalsUseCase, GetJournalUseCase, ListPeriodsUseCase } from "./usecases/journal-queries.usecases";
import { PostManualJournalUseCase, ReverseJournalUseCase } from "./usecases/journal-commands.usecases";
import { SetOpeningBalanceUseCase, RecordTransferUseCase } from "./usecases/books-commands.usecases";
import { AccountBalancesUseCase, CashBookUseCase } from "./usecases/ledger-report.usecases";
import { LedgerController } from "./controllers/ledger.controller";

/*
| Requires: the audit module (auditService). `postingService` is what the other finance modules
| (fees, payments, expenses, payroll) use to write into the books.
*/
export const registerLedger = (container: AwilixContainer): void => {
    container.register({
        journalMapper:        asClass(JournalMapper).singleton(),
        financePeriodMapper:  asClass(FinancePeriodMapper).singleton(),
        ledgerAccountMapper:  asClass(LedgerAccountMapper).singleton(),
        ledgerReportMapper:   asClass(LedgerReportMapper).singleton(),

        journalRepository:       asClass(JournalRepositoryImpl).scoped(),
        financePeriodRepository: asClass(FinancePeriodRepositoryImpl).scoped(),
        ledgerAccountRepository: asClass(LedgerAccountRepositoryImpl).scoped(),
        ledgerReportRepository:  asClass(LedgerReportRepositoryImpl).scoped(),

        numberSequenceService: asClass(NumberSequenceService).singleton(),
        postingService:        asClass(PostingService).scoped(),

        listJournalsUseCase:       asClass(ListJournalsUseCase).scoped(),
        getJournalUseCase:         asClass(GetJournalUseCase).scoped(),
        listPeriodsUseCase:        asClass(ListPeriodsUseCase).scoped(),
        postManualJournalUseCase:  asClass(PostManualJournalUseCase).scoped(),
        reverseJournalUseCase:     asClass(ReverseJournalUseCase).scoped(),
        setOpeningBalanceUseCase:  asClass(SetOpeningBalanceUseCase).scoped(),
        recordTransferUseCase:     asClass(RecordTransferUseCase).scoped(),
        accountBalancesUseCase:    asClass(AccountBalancesUseCase).scoped(),
        cashBookUseCase:           asClass(CashBookUseCase).scoped(),

        ledgerController:          asClass(LedgerController).scoped(),
    });
};
