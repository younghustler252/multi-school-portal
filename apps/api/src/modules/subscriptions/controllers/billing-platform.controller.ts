import { Request, Response, NextFunction } from "express";
import {
    ListSubscriptionsUseCase, GetSchoolSubscriptionUseCase, PlatformChangePlanUseCase, ExtendPeriodUseCase, PlatformInvoicesUseCase, GetBillingStatsUseCase,
} from "../usecases/platform/platform-billing.usecases";
import { sendSuccess } from "../../../shared/utils/api-response";
import { ListSubscriptionsQuery, ListPlatformInvoicesQuery } from "../dtos/subscription.dto";
import { billingErrors } from "../domain/subscription.errors";

interface Dependencies {
    listSubscriptionsUseCase: ListSubscriptionsUseCase; getSchoolSubscriptionUseCase: GetSchoolSubscriptionUseCase;
    platformChangePlanUseCase: PlatformChangePlanUseCase; extendPeriodUseCase: ExtendPeriodUseCase;
    platformInvoicesUseCase: PlatformInvoicesUseCase; getBillingStatsUseCase: GetBillingStatsUseCase;
}

const actorOf = (req: Request): string => { if (!req.auth) throw billingErrors.notFound(); return req.auth.userId; };
const paged = (res: Response, message: string, r: { data: unknown; meta: unknown }) => res.status(200).json({ success: true, message, data: r.data, meta: r.meta });

/* PLATFORM BILLING CONTROLLER (mounted at /platform/subscriptions, admin host). */
export class BillingPlatformController {
    constructor(private readonly d: Dependencies) {}

    list  = async (req: Request, res: Response, next: NextFunction) => { try { paged(res, "Subscriptions retrieved successfully", await this.d.listSubscriptionsUseCase.execute(ListSubscriptionsQuery.parse(req.query))); } catch (e) { next(e); } };
    stats = async (_q: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getBillingStatsUseCase.execute(), "Billing stats retrieved successfully"); } catch (e) { next(e); } };
    get   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getSchoolSubscriptionUseCase.execute(String(req.params.schoolId)), "Subscription retrieved successfully"); } catch (e) { next(e); } };
    changePlan = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.platformChangePlanUseCase.execute(String(req.params.schoolId), actorOf(req), req.body), "Plan changed successfully"); } catch (e) { next(e); } };
    extend = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.extendPeriodUseCase.execute(String(req.params.schoolId), actorOf(req), req.body), "Period extended successfully"); } catch (e) { next(e); } };

    listInvoices = async (req: Request, res: Response, next: NextFunction) => { try { paged(res, "Invoices retrieved successfully", await this.d.platformInvoicesUseCase.list(ListPlatformInvoicesQuery.parse(req.query))); } catch (e) { next(e); } };
    voidInvoice  = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.platformInvoicesUseCase.void(String(req.params.id), actorOf(req), req.body), "Invoice voided"); } catch (e) { next(e); } };
    markPaid     = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.platformInvoicesUseCase.markPaid(String(req.params.id), actorOf(req), req.body), "Invoice marked as paid"); } catch (e) { next(e); } };
}
