import {
    Request,
    Response,
    NextFunction,
}                                from "express";

import { SubmitFeedbackUseCase }       from "../usecases/submit-feedback.usecase";
import { GetFeedbackUseCase }          from "../usecases/get-feedback.usecase";
import { ListFeedbackUseCase }         from "../usecases/list-feedback.usecase";
import { GetMyFeedbackUseCase }        from "../usecases/get-my-feedback.usecase";
import { UpdateFeedbackStatusUseCase } from "../usecases/update-feedback-status.usecase";
import { RespondToFeedbackUseCase }    from "../usecases/respond-to-feedback.usecase";
import { DeleteFeedbackUseCase }       from "../usecases/delete-feedback.usecase";

import {
    sendSuccess,
    sendCreated,
    sendPaginated,
}                                from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| FEEDBACK CONTROLLER
|--------------------------------------------------------------------------
*/

interface Dependencies {
    submitFeedbackUseCase:       SubmitFeedbackUseCase;
    getFeedbackUseCase:          GetFeedbackUseCase;
    listFeedbackUseCase:         ListFeedbackUseCase;
    getMyFeedbackUseCase:        GetMyFeedbackUseCase;
    updateFeedbackStatusUseCase: UpdateFeedbackStatusUseCase;
    respondToFeedbackUseCase:    RespondToFeedbackUseCase;
    deleteFeedbackUseCase:       DeleteFeedbackUseCase;
}

export class FeedbackController {
    private readonly submitFeedbackUseCase:       SubmitFeedbackUseCase;
    private readonly getFeedbackUseCase:          GetFeedbackUseCase;
    private readonly listFeedbackUseCase:         ListFeedbackUseCase;
    private readonly getMyFeedbackUseCase:        GetMyFeedbackUseCase;
    private readonly updateFeedbackStatusUseCase: UpdateFeedbackStatusUseCase;
    private readonly respondToFeedbackUseCase:    RespondToFeedbackUseCase;
    private readonly deleteFeedbackUseCase:       DeleteFeedbackUseCase;

    constructor({
        submitFeedbackUseCase,
        getFeedbackUseCase,
        listFeedbackUseCase,
        getMyFeedbackUseCase,
        updateFeedbackStatusUseCase,
        respondToFeedbackUseCase,
        deleteFeedbackUseCase,
    }: Dependencies) {
        this.submitFeedbackUseCase       = submitFeedbackUseCase;
        this.getFeedbackUseCase          = getFeedbackUseCase;
        this.listFeedbackUseCase         = listFeedbackUseCase;
        this.getMyFeedbackUseCase        = getMyFeedbackUseCase;
        this.updateFeedbackStatusUseCase = updateFeedbackStatusUseCase;
        this.respondToFeedbackUseCase    = respondToFeedbackUseCase;
        this.deleteFeedbackUseCase       = deleteFeedbackUseCase;
    }

    // ── Submit feedback ──────────────────────────────────────────────────
    submitFeedback = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.submitFeedbackUseCase.execute(
                req.body,
                req.user?.id ?? null,
                req.user?.schoolId ?? null,
            );

            sendCreated(
                res,
                result,
                "Feedback submitted successfully",
            );
        } catch (err) {
            next(err);
        }
    };

    // ── List feedback ────────────────────────────────────────────────────
    listFeedback = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.listFeedbackUseCase.execute(
                req.query as any,
            );

            sendPaginated(
                res,
                result.data,
                result.meta,
            );
        } catch (err) {
            next(err);
        }
    };

    // ── Get single feedback ──────────────────────────────────────────────
    getFeedback = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getFeedbackUseCase.execute(
                req.params.id as string,
            );

            sendSuccess(
                res,
                result,
                "Feedback retrieved successfully",
            );
        } catch (err) {
            next(err);
        }
    };

    // ── Get my feedback ──────────────────────────────────────────────────
    getMyFeedback = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getMyFeedbackUseCase.execute(
                req.user!.id,
            );

            sendSuccess(
                res,
                result,
                "Feedback retrieved successfully",
            );
        } catch (err) {
            next(err);
        }
    };

    // ── Update feedback status ───────────────────────────────────────────
    updateFeedbackStatus = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result =
                await this.updateFeedbackStatusUseCase.execute(
                    req.params.id as string,
                    req.body,
                );

            sendSuccess(
                res,
                result,
                "Feedback status updated successfully",
            );
        } catch (err) {
            next(err);
        }
    };

    // ── Respond to feedback ──────────────────────────────────────────────
    respondToFeedback = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result =
                await this.respondToFeedbackUseCase.execute(
                    req.params.id as string,
                    req.body,
                );

            sendSuccess(
                res,
                result,
                "Feedback response submitted successfully",
            );
        } catch (err) {
            next(err);
        }
    };

    // ── Delete feedback ──────────────────────────────────────────────────
    deleteFeedback = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result =
                await this.deleteFeedbackUseCase.execute(
                    req.params.id as string,
                );

            sendSuccess(
                res,
                result,
                "Feedback deleted successfully",
            );
        } catch (err) {
            next(err);
        }
    };
}
