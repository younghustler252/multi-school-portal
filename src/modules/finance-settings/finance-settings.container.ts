import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { FinanceSettingsRepositoryImpl } from "./repositories/finance-settings.repository.impl";
import { FinanceSettingsService } from "./services/finance-settings.service";
import { GetFinanceSettingsUseCase, UpdateFinanceSettingsUseCase } from "./usecases/finance-settings.usecases";
import { FinanceSettingsController } from "./controllers/finance-settings.controller";

/*
| Requires: the audit module (auditService). `financeSettingsService` is what the finance modules (expenses, payroll, fees,
| payments, reports, period close, bank reconciliation) ask for the school's approval, budget and calendar rules.
*/
export const registerFinanceSettings = (container: AwilixContainer): void => {
    container.register({
        financeSettingsRepository: asClass(FinanceSettingsRepositoryImpl).scoped(),
        financeSettingsService:    asClass(FinanceSettingsService).scoped(),

        getFinanceSettingsUseCase:    asClass(GetFinanceSettingsUseCase).scoped(),
        updateFinanceSettingsUseCase: asClass(UpdateFinanceSettingsUseCase).scoped(),

        financeSettingsController: asClass(FinanceSettingsController).scoped(),
    });
};
