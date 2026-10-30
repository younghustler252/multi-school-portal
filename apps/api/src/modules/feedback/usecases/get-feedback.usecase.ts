import { NotFoundError } from "../../../shared/errors/domain.errors";

import { IFeedbackRepository } from "../repositories/feedback.repository";
import { EnrichedFeedback } from "../types/feedback.types";

interface Dependencies {
    feedbackRepository: IFeedbackRepository;
}

export class GetFeedbackUseCase {
    private readonly feedbackRepository: IFeedbackRepository;

    constructor({
        feedbackRepository,
    }: Dependencies) {
        this.feedbackRepository = feedbackRepository;
    }

    async execute(
        id: string,
    ): Promise<EnrichedFeedback> {
        const feedback =
            await this.feedbackRepository.findByIdEnriched(id);

        if (!feedback) {
            throw new NotFoundError(
                "Feedback not found",
            );
        }

        return feedback;
    }
}
