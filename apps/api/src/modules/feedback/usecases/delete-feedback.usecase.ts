import { NotFoundError } from "../../../shared/errors/domain.errors";

import { IFeedbackRepository } from "../repositories/feedback.repository";

interface Dependencies {
    feedbackRepository: IFeedbackRepository;
}

export class DeleteFeedbackUseCase {
    private readonly feedbackRepository: IFeedbackRepository;

    constructor({
        feedbackRepository,
    }: Dependencies) {
        this.feedbackRepository = feedbackRepository;
    }

    async execute(id: string) {
        const existing =
            await this.feedbackRepository.findById(id);

        if (!existing) {
            throw new NotFoundError(
                "Feedback not found",
            );
        }

        await this.feedbackRepository.delete(id);

        return {
            message: "Feedback deleted successfully",
        };
    }
}