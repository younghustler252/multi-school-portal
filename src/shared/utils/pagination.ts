import { PaginationMeta } from "./api-response";

/*
|--------------------------------------------------------------------------
| PAGINATION HELPERS
|--------------------------------------------------------------------------
*/

export interface PaginationParams {
    page:  number;
    limit: number;
    skip:  number;
}

export const parsePagination = (
    query: Record<string, any>,
    defaultLimit = 20,
    maxLimit     = 100,
): PaginationParams => {
    const page  = Math.max(1, parseInt(query.page)  || 1);
    const limit = Math.min(
        maxLimit,
        Math.max(1, parseInt(query.limit) || defaultLimit),
    );
    const skip  = (page - 1) * limit;

    return { page, limit, skip };
};

export const buildPaginationMeta = (
    total:  number,
    page:   number,
    limit:  number,
): PaginationMeta => {
    const totalPages = Math.ceil(total / limit);

    return {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };
};