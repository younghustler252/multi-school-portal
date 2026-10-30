import { Request, Response, NextFunction } from "express";
import {
    GetBillingSummaryUseCase, ListMyInvoicesUseCase, GetMyInvoiceUseCase,
} from "../usecases/billing-summary.usecases";
import { PreviewPlanChangeUseCase, ChangePlanUseCase, RequestDowngradeUseCase } from "../usecases/plan-change.usecases";
import {
    VerifyBillingPaymentUseCase, PayInvoiceUseCase, ToggleAutoRenewUseCase, ManagePaymentMethodsUseCase, CancelSubscriptionUseCase,
} from "../usecases/payments.usecases";
import { sendSuccess } from "../../../shared/utils/api-response";
import { ListInvoicesQuery, VerifyPaymentQuery } from "../dtos/subscription.dto";
import { billingErrors } from "../domain/subscription.errors";

interface Dependencies {
    getBillingSummaryUseCase: GetBillingSummaryUseCase; listMyInvoicesUseCase: ListMyInvoicesUseCase; getMyInvoiceUseCase: GetMyInvoiceUseCase;
    previewPlanChangeUseCase: PreviewPlanChangeUseCase; changePlanUseCase: ChangePlanUseCase; requestDowngradeUseCase: RequestDowngradeUseCase;
    verifyBillingPaymentUseCase: VerifyBillingPaymentUseCase; payInvoiceUseCase: PayInvoiceUseCase; toggleAutoRenewUseCase: ToggleAutoRenewUseCase;
    managePaymentMethodsUseCase: ManagePaymentMethodsUseCase; cancelSubscriptionUseCase: CancelSubscriptionUseCase;
}

/* BILLING CONTROLLER (school realm, mounted at /billing). The school is the host's school; the user is req.auth. */
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf = (req: Request): string => { if (!req.auth) throw billingErrors.notFound(); return req.auth.userId; };

export class BillingController {
    constructor(private readonly d: Dependencies) {}

    summary = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getBillingSummaryUseCase.execute(schoolIdOf(req)), "Billing retrieved successfully"); } catch (e) { next(e); } };
    preview = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.previewPlanChangeUseCase.execute(schoolIdOf(req), req.body), "Preview calculated"); } catch (e) { next(e); } };
    changePlan = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.changePlanUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Plan change started"); } catch (e) { next(e); } };

    verify = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.verifyBillingPaymentUseCase.execute(schoolIdOf(req), VerifyPaymentQuery.parse(req.query).reference), "Payment checked"); } catch (e) { next(e); }
    };

    listInvoices = async (req: Request, res: Response, next: NextFunction) => {
        try { const r = await this.d.listMyInvoicesUseCase.execute(schoolIdOf(req), ListInvoicesQuery.parse(req.query)); res.status(200).json({ success: true, message: "Invoices retrieved successfully", data: r.data, meta: r.meta }); } catch (e) { next(e); }
    };
    getInvoice = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getMyInvoiceUseCase.execute(schoolIdOf(req), String(req.params.id)), "Invoice retrieved successfully"); } catch (e) { next(e); } };
    payInvoice = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.payInvoiceUseCase.execute(schoolIdOf(req), userIdOf(req), String(req.params.id), req.body?.autoRenew === true), "Checkout started"); } catch (e) { next(e); }
    };

    requestDowngrade = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.requestDowngradeUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Downgrade scheduled"); } catch (e) { next(e); } };
    cancelDowngrade  = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.requestDowngradeUseCase.cancel(schoolIdOf(req), userIdOf(req)), "Scheduled downgrade cancelled"); } catch (e) { next(e); } };
    cancel = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.cancelSubscriptionUseCase.cancel(schoolIdOf(req), userIdOf(req), req.body), "Cancellation processed"); } catch (e) { next(e); } };
    resume = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.cancelSubscriptionUseCase.resume(schoolIdOf(req), userIdOf(req)), "Subscription resumed"); } catch (e) { next(e); } };
    autoRenew = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.toggleAutoRenewUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Automatic renewal updated"); } catch (e) { next(e); } };
    listMethods = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.managePaymentMethodsUseCase.list(schoolIdOf(req)), "Payment methods retrieved successfully"); } catch (e) { next(e); } };
    removeMethod = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.managePaymentMethodsUseCase.remove(schoolIdOf(req), userIdOf(req), String(req.params.id)), "Payment method removed"); } catch (e) { next(e); } };
}
