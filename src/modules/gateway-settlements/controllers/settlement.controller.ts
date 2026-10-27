import { Request, Response, NextFunction } from "express";
import {
    PreviewSettlementReportUseCase, RecordSettlementReportUseCase, SettlePaymentsUseCase, ListUnsettledUseCase, ListSettlementsUseCase,
    GetSettlementUseCase, ReverseSettlementUseCase,
} from "../usecases/settlement.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { PageQuery } from "../dtos/settlement.dto";

interface Dependencies {
    previewSettlementReportUseCase: PreviewSettlementReportUseCase; recordSettlementReportUseCase: RecordSettlementReportUseCase;
    settlePaymentsUseCase: SettlePaymentsUseCase; listUnsettledUseCase: ListUnsettledUseCase; listSettlementsUseCase: ListSettlementsUseCase;
    getSettlementUseCase: GetSettlementUseCase; reverseSettlementUseCase: ReverseSettlementUseCase;
}

const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };

/* GATEWAY SETTLEMENTS CONTROLLER (school realm, /finance/settlements). Bodies are already validated and converted by the route. */
export class SettlementController {
    constructor(private readonly d: Dependencies) {}

    unsettled = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listUnsettledUseCase.execute(PageQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Unsettled online payments retrieved successfully", data: r.data, meta: { ...r.meta, unsettledKobo: r.unsettledKobo, clearingBalanceKobo: r.clearingBalanceKobo, differenceKobo: r.differenceKobo } });
        } catch (e) { next(e); }
    };
    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listSettlementsUseCase.execute(PageQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Settlements retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getSettlementUseCase.execute(String(req.params.id)), "Settlement retrieved successfully"); } catch (e) { next(e); }
    };
    preview = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.previewSettlementReportUseCase.execute(req.body), "Settlement report checked"); } catch (e) { next(e); }
    };
    recordReport = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.recordSettlementReportUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Settlement report processed"); } catch (e) { next(e); }
    };
    settlePayments = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.settlePaymentsUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Settlement recorded successfully"); } catch (e) { next(e); }
    };
    reverse = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.reverseSettlementUseCase.execute(String(req.params.id), schoolIdOf(req), userIdOf(req), req.body), "Settlement reversed successfully"); } catch (e) { next(e); }
    };
}
