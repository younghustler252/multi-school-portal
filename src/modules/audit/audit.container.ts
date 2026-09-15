import { asClass }                from "awilix";
import type { AwilixContainer }   from "awilix";
import { AuditMapper }            from "./mappers/audit.mapper";
import { AuditRepositoryImpl }    from "./repositories/audit.repository.impl";
import { AuditService }           from "./services/audit.service";
import { GetAuditLogsUseCase }    from "./usecases/get-audit-logs.usecase";
import { GetMyOrgActivityUseCase } from "./usecases/get-my-org-activity.usecase";
import { GetSchoolActivityUseCase } from "./usecases/get-school-activity.usecase";
import { AuditController }        from "./controllers/audit.controller";

export const registerAudit = (container: AwilixContainer): void => {
    container.register({
        auditMapper:         asClass(AuditMapper).singleton(),
        auditRepository:     asClass(AuditRepositoryImpl).scoped(),
        auditService:        asClass(AuditService).singleton(),
        getAuditLogsUseCase: asClass(GetAuditLogsUseCase).scoped(),
        getMyOrgActivityUseCase: asClass(GetMyOrgActivityUseCase).scoped(),
        getSchoolActivityUseCase: asClass(GetSchoolActivityUseCase).scoped(),
        auditController:     asClass(AuditController).scoped(),
    });
};