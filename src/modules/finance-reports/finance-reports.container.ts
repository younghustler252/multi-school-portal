import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { StatementRepositoryImpl } from "./repositories/statement.repository.impl";
import { ReportEngine } from "./services/report-engine.service";
import { ListReportsUseCase, RunReportUseCase, ExportReportUseCase, FinanceDashboardUseCase } from "./usecases/report.usecases";
import { FinanceReportController } from "./controllers/report.controller";

/* Requires the ledger, fees and expenses modules (the engine runs their reports) and the entitlements service. */
export const registerFinanceReports = (container: AwilixContainer): void => {
    container.register({
        statementRepository:     asClass(StatementRepositoryImpl).scoped(),
        reportEngine:            asClass(ReportEngine).scoped(),
        listReportsUseCase:      asClass(ListReportsUseCase).scoped(),
        runReportUseCase:        asClass(RunReportUseCase).scoped(),
        exportReportUseCase:     asClass(ExportReportUseCase).scoped(),
        financeDashboardUseCase: asClass(FinanceDashboardUseCase).scoped(),
        financeReportController: asClass(FinanceReportController).scoped(),
    });
};
