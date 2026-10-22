import { Request, Response, NextFunction } from "express";
import { RecordPaymentUseCase, ConfirmPaymentUseCase, RejectPaymentUseCase, PreviewAllocationUseCase } from "../usecases/payment-record.usecases";
import { ListPaymentsUseCase, GetPaymentUseCase, GetReceiptUseCase } from "../usecases/payment-queries.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { ListPaymentsQuery } from "../dtos/payment.dto";

interface Dependencies {
    recordPaymentUseCase: RecordPaymentUseCase; confirmPaymentUseCase: ConfirmPaymentUseCase; rejectPaymentUseCase: RejectPaymentUseCase;
    previewAllocationUseCase: PreviewAllocationUseCase; listPaymentsUseCase: ListPaymentsUseCase; getPaymentUseCase: GetPaymentUseCase; getReceiptUseCase: GetReceiptUseCase;
}

/* PAYMENT CONTROLLER (school realm, /payments). Bodies are already validated and converted by the route; queries are parsed here. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

export class PaymentController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listPaymentsUseCase.execute(ListPaymentsQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Payments retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getPaymentUseCase.execute(idOf(req)), "Payment retrieved successfully"); } catch (e) { next(e); }
    };
    receipt = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getReceiptUseCase.execute(idOf(req)), "Receipt retrieved successfully"); } catch (e) { next(e); }
    };
    record = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.recordPaymentUseCase.execute(schoolIdOf(req), userIdOf(req), req.body);
            r.duplicate ? sendSuccess(res, r.payment, "Payment was already recorded") : sendCreated(res, r.payment, "Payment recorded successfully");
        } catch (e) { next(e); }
    };
    preview = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.previewAllocationUseCase.execute(req.body), "Allocation previewed successfully"); } catch (e) { next(e); }
    };
    confirm = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.confirmPaymentUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Payment confirmed successfully"); } catch (e) { next(e); }
    };
    reject = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.rejectPaymentUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Payment rejected successfully"); } catch (e) { next(e); }
    };
}
