import { NotFoundError } from "../../../shared/errors/domain.errors";

import {
    RespondToFeedbackDtoType,
} from "../dtos/feedback.dto";

import { IFeedbackRepository } from "../repositories/feedback.repository";

import {
    FeedbackStatus,
} from "../domain/feedback.enums";

interface Dependencies {
    feedbackRepository: IFeedbackRepository;
}

export class RespondToFeedbackUseCase {
    private readonly feedbackRepository: IFeedbackRepository;

    constructor({
        feedbackRepository,
    }: Dependencies) {
        this.feedbackRepository = feedbackRepository;
    }

    async execute(
        id: string,
        dto: RespondToFeedbackDtoType,
    ) {
        const existing =
            await this.feedbackRepository.findById(id);

        if (!existing) {
            throw new NotFoundError(
                "Feedback not found",
            );
        }

        return this.feedbackRepository.respond(
            id,
            dto.response,
            dto.status ?? FeedbackStatus.RESOLVED,
        );
    }
}
