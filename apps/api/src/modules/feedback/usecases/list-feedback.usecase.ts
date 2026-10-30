import { IFeedbackRepository } from "../repositories/feedback.repository";
import { ListFeedbackDtoType } from "../dtos/feedback.dto";
import { EnrichedFeedback } from "../types/feedback.types";
import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";

interface Dependencies {
    feedbackRepository: IFeedbackRepository;
}

export class ListFeedbackUseCase {
    private readonly feedbackRepository: IFeedbackRepository;

    constructor({
        feedbackRepository,
    }: Dependencies) {
        this.feedbackRepository = feedbackRepository;
    }

    async execute(
        dto: ListFeedbackDtoType,
    ): Promise<PaginatedResult<EnrichedFeedback>> {
        const where: Record<string, any> = {};

        if (dto.type) {
            where.type = dto.type;
        }

        if (dto.status) {
            where.status = dto.status;
        }

        if (dto.userId) {
            where.userId = dto.userId;
        }

        if (dto.schoolId) {
            where.schoolId = dto.schoolId;
        }

        return this.feedbackRepository.paginateEnriched({
            page: dto.page,
            limit: dto.limit,
            where,
            orderBy: {
                createdAt: "desc",
            },
        });
    }
}
