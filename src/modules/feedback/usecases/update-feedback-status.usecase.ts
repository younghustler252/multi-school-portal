import { NotFoundError } from "../../../shared/errors/domain.errors";

import {
    UpdateFeedbackStatusDtoType,
} from "../dtos/feedback.dto";

import { IFeedbackRepository } from "../repositories/feedback.repository";

interface Dependencies {
    feedbackRepository: IFeedbackRepository;
}

export class UpdateFeedbackStatusUseCase {
    private readonly feedbackRepository: IFeedbackRepository;

    constructor({
        feedbackRepository,
    }: Dependencies) {
        this.feedbackRepository = feedbackRepository;
    }

    async execute(
        id: string,
        dto: UpdateFeedbackStatusDtoType,
    ) {
        const existing =
            await this.feedbackRepository.findById(id);

        if (!existing) {
            throw new NotFoundError(
                "Feedback not found",
            );
        }

        return this.feedbackRepository.updateStatus(
            id,
            dto.status,
        );
    }
}
