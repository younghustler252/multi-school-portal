import { asClass }                from "awilix";
import type { AwilixContainer }   from "awilix";
import { AuditMapper }            from "./mappers/audit.mapper";
import { AuditRepositoryImpl }    from "./repositories/audit.repository.impl";
import { AuditService }           from "./services/audit.service";
import { AuditLogEnricherService } from "./services/audit-log-enricher.service";
import { ListPlatformAuditLogsUseCase, ListSchoolAuditLogsUseCase } from "./usecases/list-audit-logs.usecases";
import { AuditController }        from "./controllers/audit.controller";

/* Requires registerAuth (userRepository). The two old activity use cases are replaced by the two below. */
export const registerAudit = (container: AwilixContainer): void => {
    container.register({
        auditMapper:                 asClass(AuditMapper).singleton(),
        auditRepository:             asClass(AuditRepositoryImpl).scoped(),
        auditService:                asClass(AuditService).singleton(),
        auditLogEnricherService:     asClass(AuditLogEnricherService).scoped(),
        listPlatformAuditLogsUseCase: asClass(ListPlatformAuditLogsUseCase).scoped(),
        listSchoolAuditLogsUseCase:   asClass(ListSchoolAuditLogsUseCase).scoped(),
        auditController:             asClass(AuditController).scoped(),
    });
};
