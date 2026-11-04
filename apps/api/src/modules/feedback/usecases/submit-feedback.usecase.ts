import { MailService } from "../../../infrastructure/mail/mail.service";

import { IFeedbackRepository } from "../repositories/feedback.repository";
import { IPlatformSettingsRepository } from "../../platform-settings/repositories/platform-settings.repository";
import { SubmitFeedbackDtoType } from "../dtos/feedback.dto";

interface Dependencies {
    feedbackRepository: IFeedbackRepository;
    mailService: MailService;
    platformSettingsRepository: IPlatformSettingsRepository;
}

export class SubmitFeedbackUseCase {
    private readonly feedbackRepository: IFeedbackRepository;
    private readonly mailService: MailService;
    private readonly platformSettings: IPlatformSettingsRepository;

    constructor({
        feedbackRepository,
        mailService,
        platformSettingsRepository,
    }: Dependencies) {
        this.feedbackRepository = feedbackRepository;
        this.mailService = mailService;
        this.platformSettings = platformSettingsRepository;
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
            // The team's address is the platform's support email (Platform settings); nobody is emailed when it is empty.
            const supportEmail = (await this.platformSettings.find()).supportEmail?.trim();
            if (!supportEmail) return feedback;

            await this.mailService.sendLetter(
                supportEmail,
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
