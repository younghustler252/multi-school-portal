import { IFeedbackRepository } from "../repositories/feedback.repository";

interface Dependencies {
    feedbackRepository: IFeedbackRepository;
}

export class GetMyFeedbackUseCase {
    private readonly feedbackRepository: IFeedbackRepository;

    constructor({
        feedbackRepository,
    }: Dependencies) {
        this.feedbackRepository = feedbackRepository;
    }

    async execute(userId: string) {
        return this.feedbackRepository.findByUserId(
            userId,
        );
    }
}
