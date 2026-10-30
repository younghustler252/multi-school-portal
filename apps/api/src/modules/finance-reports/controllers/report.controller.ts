import { Request, Response, NextFunction } from "express";
import { ListReportsUseCase, RunReportUseCase, ExportReportUseCase, FinanceDashboardUseCase } from "../usecases/report.usecases";
import { ReportCaller } from "../services/report-engine.service";
import { EntitlementsService } from "../../../foundation/entitlements.service";
import { sendSuccess } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";

interface Dependencies {
    listReportsUseCase: ListReportsUseCase; runReportUseCase: RunReportUseCase; exportReportUseCase: ExportReportUseCase;
    financeDashboardUseCase: FinanceDashboardUseCase; entitlementsService: EntitlementsService;
}

/* FINANCE REPORT CONTROLLER (school realm). Who is asking comes from the token and role, never from the request body or query. */
export class FinanceReportController {
    constructor(private readonly d: Dependencies) {}

    private callerOf(req: Request): ReportCaller {
        if (!req.access) throw new UnauthorizedError("No token provided", "TOKEN_MISSING");
        const access = req.access, schoolId = req.schoolId as string;
        return {
            can: (permission: string) => access.can(permission),
            hasFeature: async (feature: string) => (await this.d.entitlementsService.checkFeature(schoolId, feature)).allowed,
        };
    }

    list = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listReportsUseCase.execute(this.callerOf(req)), "Reports retrieved successfully"); } catch (e) { next(e); }
    };

    run = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.runReportUseCase.execute(String(req.params.key), req.query as Record<string, unknown>, this.callerOf(req)), "Report generated successfully"); } catch (e) { next(e); }
    };

    export = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const f = await this.d.exportReportUseCase.execute(String(req.params.key), req.query as Record<string, unknown>, this.callerOf(req));
            res.status(200).set({ "Content-Type": f.contentType, "Content-Disposition": `attachment; filename="${f.filename}"`, "Cache-Control": "no-store" }).send(f.body);
        } catch (e) { next(e); }
    };

    dashboard = async (_req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.financeDashboardUseCase.execute(), "Dashboard retrieved successfully"); } catch (e) { next(e); }
    };
}
