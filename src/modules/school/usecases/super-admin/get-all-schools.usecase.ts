// usecases/super-admin/get-all-schools.usecase.ts

import { ISchoolRepository }    from "../../repositories/school.repository";
import { SchoolMapper }         from "../../mappers/school.mapper";
import { SchoolResponseData }   from "../../mappers/school.mapper";
import {
    PaginatedResult,
    PaginateParams,
}                               from "../../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| GET ALL SCHOOLS USE CASE
| Super admin views all schools with pagination and filters
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository: ISchoolRepository;
    schoolMapper:     SchoolMapper;
}

export class GetAllSchoolsUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly schoolMapper:     SchoolMapper;

    constructor({ schoolRepository, schoolMapper }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper     = schoolMapper;
    }

    async execute(params: {
        page?:               number;
        limit?:              number;
        status?:             string;
        verificationStatus?: string;
        search?:             string;
    }): Promise<PaginatedResult<SchoolResponseData>> {

        // ── Build filter ──────────────────────────────────────────────────
        const where: Record<string, any> = {};

        if (params.status) {
            where.status = params.status;
        }

        if (params.verificationStatus) {
            where.verificationStatus = params.verificationStatus;
        }

        if (params.search) {
            where.OR = [
                { name:      { contains: params.search, mode: "insensitive" } },
                { email:     { contains: params.search, mode: "insensitive" } },
                { subdomain: { contains: params.search, mode: "insensitive" } },
            ];
        }

        // ── Paginate ──────────────────────────────────────────────────────
        const result = await this.schoolRepository.paginate({
            page:  params.page,
            limit: params.limit,
            where,
            orderBy: { createdAt: "desc" },
        });

        // ── Map to response ───────────────────────────────────────────────
        return {
            data: result.data.map(s => this.schoolMapper.toResponse(s)),
            meta: result.meta,
        };
    }
}