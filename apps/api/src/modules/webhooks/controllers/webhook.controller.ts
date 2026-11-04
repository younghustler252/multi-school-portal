import { Request, Response, NextFunction } from "express";
import { ReceiveWebhookUseCase, ListWebhookEventsUseCase, GetWebhookEventUseCase, WebhookSummaryUseCase, RetryWebhookEventUseCase } from "../usecases/webhook.usecases";
import { ListWebhookEventsQuery, WebhookSummaryQuery } from "../dtos/webhook.dto";
import { sendSuccess } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { webhookErrors } from "../domain/webhook.errors";

interface Dependencies {
    receiveWebhookUseCase: ReceiveWebhookUseCase; listWebhookEventsUseCase: ListWebhookEventsUseCase; getWebhookEventUseCase: GetWebhookEventUseCase;
    webhookSummaryUseCase: WebhookSummaryUseCase; retryWebhookEventUseCase: RetryWebhookEventUseCase;
}
const userIdOf = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const day = (s?: string, end = false) => s ? new Date(`${s}T${end ? "23:59:59.999" : "00:00:00.000"}Z`) : undefined;

export class WebhookController {
    constructor(private readonly d: Dependencies) {}

    /** Public entry for a provider. The route gives the RAW body (signatures are checked on the exact bytes). The answer is 200 for anything we accepted, even a failed handler. */
    receive = async (provider: string, req: Request, res: Response, next: NextFunction) => {
        try {
            if (!Buffer.isBuffer(req.body)) throw webhookErrors.badBody();
            res.status(200).json(await this.d.receiveWebhookUseCase.execute(provider, req.body.toString("utf8"), req.headers));
        } catch (e) { next(e); }
    };

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const q = ListWebhookEventsQuery.parse(req.query);
            const r = await this.d.listWebhookEventsUseCase.execute({ provider: q.provider, status: q.status, reference: q.reference, type: q.type, from: day(q.from), to: day(q.to, true) }, q.page, q.limit);
            res.status(200).json({ success: true, message: "Webhook events retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    summary = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.webhookSummaryUseCase.execute(WebhookSummaryQuery.parse(req.query).hours), "Webhook summary retrieved successfully"); } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getWebhookEventUseCase.execute(String(req.params.id)), "Webhook event retrieved successfully"); } catch (e) { next(e); }
    };
    retry = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.retryWebhookEventUseCase.execute(String(req.params.id), userIdOf(req)), "Webhook event retried"); } catch (e) { next(e); }
    };
}
