import { asClass }                    from "awilix";
import type { AwilixContainer }       from "awilix";
import { FeedbackMapper }             from "./mappers/feedback.mapper";
import { FeedbackRepositoryImpl }     from "./repositories/feedback.repository.impl";
import { SubmitFeedbackUseCase }      from "./usecases/submit-feedback.usecase";
import { GetFeedbackUseCase }         from "./usecases/get-feedback.usecase";
import { ListFeedbackUseCase }        from "./usecases/list-feedback.usecase";
import { GetMyFeedbackUseCase }       from "./usecases/get-my-feedback.usecase";
import { UpdateFeedbackStatusUseCase } from "./usecases/update-feedback-status.usecase";
import { RespondToFeedbackUseCase }   from "./usecases/respond-to-feedback.usecase";
import { DeleteFeedbackUseCase }      from "./usecases/delete-feedback.usecase";
import { FeedbackController }         from "./controllers/feedback.controller";

/*
|--------------------------------------------------------------------------
| FEEDBACK CONTAINER
|--------------------------------------------------------------------------
*/

export const registerFeedback = (container: AwilixContainer): void => {
    container.register({
        feedbackMapper:              asClass(FeedbackMapper).singleton(),
        feedbackRepository:          asClass(FeedbackRepositoryImpl).scoped(),
        submitFeedbackUseCase:       asClass(SubmitFeedbackUseCase).scoped(),
        getFeedbackUseCase:          asClass(GetFeedbackUseCase).scoped(),
        listFeedbackUseCase:         asClass(ListFeedbackUseCase).scoped(),
        getMyFeedbackUseCase:        asClass(GetMyFeedbackUseCase).scoped(),
        updateFeedbackStatusUseCase: asClass(UpdateFeedbackStatusUseCase).scoped(),
        respondToFeedbackUseCase:    asClass(RespondToFeedbackUseCase).scoped(),
        deleteFeedbackUseCase:       asClass(DeleteFeedbackUseCase).scoped(),
        feedbackController:          asClass(FeedbackController).scoped(),
    });
};
