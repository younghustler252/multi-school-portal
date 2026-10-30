import { Request, Response, NextFunction } from "express";
import {
    ListMessageTemplatesUseCase, GetMessageTemplateUseCase, SaveMessageTemplateUseCase,
    ResetMessageTemplateUseCase, PreviewMessageTemplateUseCase,
} from "../usecases/message-template.usecases";
import { sendSuccess } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";

interface Dependencies {
    listMessageTemplatesUseCase: ListMessageTemplatesUseCase;
    getMessageTemplateUseCase: GetMessageTemplateUseCase;
    saveMessageTemplateUseCase: SaveMessageTemplateUseCase;
    resetMessageTemplateUseCase: ResetMessageTemplateUseCase;
    previewMessageTemplateUseCase: PreviewMessageTemplateUseCase;
}

const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const p = (req: Request, name: string): string => String(req.params[name]);

export class MessageTemplateController {
    constructor(private readonly d: Dependencies) {}

    list = async (_req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listMessageTemplatesUseCase.execute(), "Message templates retrieved successfully"); } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getMessageTemplateUseCase.execute(p(req, "key")), "Message template retrieved successfully"); } catch (e) { next(e); }
    };
    save = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.saveMessageTemplateUseCase.execute(schoolIdOf(req), userIdOf(req), p(req, "key"), p(req, "channel"), req.body), "Message template saved successfully"); } catch (e) { next(e); }
    };
    reset = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.resetMessageTemplateUseCase.execute(schoolIdOf(req), userIdOf(req), p(req, "key"), p(req, "channel")), "Message template reset to the default"); } catch (e) { next(e); }
    };
    preview = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.previewMessageTemplateUseCase.execute(p(req, "key"), p(req, "channel"), req.body), "Preview ready"); } catch (e) { next(e); }
    };
}
