import {
    BasePublicRepository,
    PaginatedResult,
} from "../../../infrastructure/repository/base.repository";

import {
    parsePagination,
    buildPaginationMeta,
} from "../../../shared/utils/pagination";

import { FeedbackEntity } from "../domain/feedback.entity";

import {
    FeedbackStatus,
} from "../domain/feedback.enums";

import { FeedbackMapper } from "../mappers/feedback.mapper";

import {
    EnrichedFeedback,
} from "../types/feedback.types";

import { IFeedbackRepository } from "./feedback.repository";

export class FeedbackRepositoryImpl
    extends BasePublicRepository<FeedbackEntity>
    implements IFeedbackRepository
{
    protected readonly modelName = "feedback";

    private readonly feedbackMapper: FeedbackMapper;

    constructor({
        feedbackMapper,
    }: {
        feedbackMapper: FeedbackMapper;
    }) {
        super(feedbackMapper);

        this.feedbackMapper = feedbackMapper;
    }

    async findByUserId(
        userId: string,
    ): Promise<FeedbackEntity[]> {
        return this.findMany({
            userId,
        });
    }

    async findBySchoolId(
        schoolId: string,
    ): Promise<FeedbackEntity[]> {
        return this.findMany({
            schoolId,
        });
    }

    async findByIdEnriched(
        id: string,
    ): Promise<EnrichedFeedback | null> {
        const raw = await this.prisma.feedback.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName:  true,
                        email:     true,
                    },
                },
                school: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        if (!raw) return null;

        return this.feedbackMapper.toEnrichedResponse(raw);
    }

    async findManyEnriched(
        where:   Record<string, any> = {},
        orderBy: Record<string, any> = {
            createdAt: "desc",
        },
    ): Promise<EnrichedFeedback[]> {
        const raws = await this.prisma.feedback.findMany({
            where,
            orderBy,
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName:  true,
                        email:     true,
                    },
                },
                school: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        return raws.map((raw) =>
            this.feedbackMapper.toEnrichedResponse(raw),
        );
    }

    async paginateEnriched(params: {
        page?:    number;
        limit?:   number;
        where?:   Record<string, any>;
        orderBy?: Record<string, any>;
    }): Promise<PaginatedResult<EnrichedFeedback>> {
        const {
            page,
            limit,
            skip,
        } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where = params.where ?? {};

        const orderBy = params.orderBy ?? {
            createdAt: "desc",
        };

        const [raws, total] = await Promise.all([
            this.prisma.feedback.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName:  true,
                            email:     true,
                        },
                    },
                    school: {
                        select: {
                            name: true,
                        },
                    },
                },
            }),

            this.prisma.feedback.count({
                where,
            }),
        ]);

        return {
            data: raws.map((raw) =>
                this.feedbackMapper.toEnrichedResponse(raw),
            ),
            meta: buildPaginationMeta(
                total,
                page,
                limit,
            ),
        };
    }

    async updateStatus(
        id:     string,
        status: FeedbackStatus,
    ): Promise<FeedbackEntity> {
        return this.update(id, {
            status,
        });
    }

    async respond(
        id:       string,
        response: string,
        status:   FeedbackStatus = FeedbackStatus.RESOLVED,
    ): Promise<FeedbackEntity> {
        return this.update(id, {
            response,
            status,
        });
    }
}
