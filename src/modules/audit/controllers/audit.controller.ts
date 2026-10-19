import { Request, Response, NextFunction } from "express";
import { ListPlatformAuditLogsUseCase, ListSchoolAuditLogsUseCase } from "../usecases/list-audit-logs.usecases";
import { ListPlatformAuditQuery, ListSchoolAuditQuery } from "../dtos/audit.dto";

interface Dependencies { listPlatformAuditLogsUseCase: ListPlatformAuditLogsUseCase; listSchoolAuditLogsUseCase: ListSchoolAuditLogsUseCase }

const send = (res: Response, r: { data: unknown; meta: unknown }) =>
    res.status(200).json({ success: true, message: "Audit logs retrieved successfully", data: r.data, meta: r.meta });

export class AuditController {
    constructor(private readonly d: Dependencies) {}

    // Platform realm (/platform/audit)
    listPlatform = async (req: Request, res: Response, next: NextFunction) => {
        try { send(res, await this.d.listPlatformAuditLogsUseCase.execute(ListPlatformAuditQuery.parse(req.query))); } catch (e) { next(e); }
    };

    // School realm (/audit): the school is the one the host resolved to
    listSchool = async (req: Request, res: Response, next: NextFunction) => {
        try { send(res, await this.d.listSchoolAuditLogsUseCase.execute(req.schoolId as string, ListSchoolAuditQuery.parse(req.query))); } catch (e) { next(e); }
    };
}
