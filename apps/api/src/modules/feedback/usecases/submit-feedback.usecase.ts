import { MailService } from "../../../infrastructure/mail/mail.service";
import { env } from "../../../config/env";

import { IFeedbackRepository } from "../repositories/feedback.repository";
import { SubmitFeedbackDtoType } from "../dtos/feedback.dto";

interface Dependencies {
    feedbackRepository: IFeedbackRepository;
    mailService: MailService;
}

export class SubmitFeedbackUseCase {
    private readonly feedbackRepository: IFeedbackRepository;
    private readonly mailService: MailService;

    constructor({
        feedbackRepository,
        mailService,
    }: Dependencies) {
        this.feedbackRepository = feedbackRepository;
        this.mailService = mailService;
    }

    async execute(
        dto: SubmitFeedbackDtoType,
        userId: string | null,
        schoolId: string | null,
    ) {
        const feedback =
            await this.feedbackRepository.create({
                ...dto,
                userId,
                schoolId,
                pageUrl: dto.pageUrl ?? null,
            });

        try {
            await this.mailService.sendLetter(
                env?.APP_BASE_DOMAIN ?? "support@schoolportal.com",
                {
                    subject: `New feedback: ${feedback.type}`,
                    title: "New feedback received",
                    greeting: "Hi team,",
                    paragraphs: [
                        feedback.message,
                        ...(feedback.pageUrl
                            ? [`From: ${feedback.pageUrl}`]
                            : []),
                    ],
                    footer: `School: ${schoolId ?? "N/A"}`,
                },
            );
        } catch (error) {
            // Feedback has already been saved successfully.
            // Email failure should not cause the submission to fail.
            console.error(
                "Failed to send feedback notification email",
                error,
            );
        }

        return feedback;
    }
}
