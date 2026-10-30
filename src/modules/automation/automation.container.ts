import { asClass, asFunction } from "awilix";
import type { AwilixContainer } from "awilix";
import { AutomationRuleRepositoryImpl, AutomationRunRepositoryImpl, AutomationSourceRepositoryImpl } from "./repositories/automation.repository.impl";
import { AutomationRunnerService } from "./services/automation-runner.service";
import {
    ListAutomationsUseCase, GetAutomationUseCase, UpdateAutomationUseCase, DryRunAutomationUseCase,
    RunAutomationNowUseCase, ListAutomationRunsUseCase, RunDueAutomationsUseCase, RunAutomationsForAllSchoolsUseCase,
} from "./usecases/automation.usecases";
import { AutomationController } from "./controllers/automation.controller";
import { TenantContext } from "../../infrastructure/database/prisma/tenant.context";

/*
| Requires: notifications (dispatch and channel policy), message templates, school settings, the audit module, the foundation
| (entitlementsService) and the shared prismaClient (the school's name).
*/
export const registerAutomation = (container: AwilixContainer): void => {
    container.register({
        automationRuleRepository:    asClass(AutomationRuleRepositoryImpl).scoped(),
        automationRunRepository:     asClass(AutomationRunRepositoryImpl).scoped(),
        automationSourceRepository:  asClass(AutomationSourceRepositoryImpl).scoped(),
        automationRunnerService: asFunction((c: any) => new AutomationRunnerService({
            ...c,
            schoolName: async () => {
                const school = await c.prismaClient.school.findUnique({ where: { id: TenantContext.get().schoolId }, select: { name: true } });
                return school?.name ?? "Your school";
            },
        })).scoped(),

        listAutomationsUseCase:        asClass(ListAutomationsUseCase).scoped(),
        getAutomationUseCase:          asClass(GetAutomationUseCase).scoped(),
        updateAutomationUseCase:       asClass(UpdateAutomationUseCase).scoped(),
        dryRunAutomationUseCase:       asClass(DryRunAutomationUseCase).scoped(),
        runAutomationNowUseCase:       asClass(RunAutomationNowUseCase).scoped(),
        listAutomationRunsUseCase:     asClass(ListAutomationRunsUseCase).scoped(),
        runDueAutomationsUseCase:      asClass(RunDueAutomationsUseCase).scoped(),
        runAutomationsForAllSchoolsUseCase: asClass(RunAutomationsForAllSchoolsUseCase).scoped(),

        automationController:          asClass(AutomationController).scoped(),
    });
};
