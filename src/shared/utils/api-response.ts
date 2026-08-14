import { Response } from "express";

/*
|--------------------------------------------------------------------------
| API RESPONSE HELPERS
| Consistent response shape across all endpoints
|--------------------------------------------------------------------------
*/

export interface ApiResponse<T = null> {
    success:   boolean;
    message:   string;
    data?:     T;
    errors?:   Record<string, string>;
    meta?:     PaginationMeta;
}

export interface PaginationMeta {
    total:       number;
    page:        number;
    limit:       number;
    totalPages:  number;
    hasNext:     boolean;
    hasPrev:     boolean;
}

// ── Success ─────────────────────────────────────────────────────────────
export const sendSuccess = <T>(
    res:        Response,
    data:       T,
    message   = "Success",
    statusCode = 200,
): Response => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    } satisfies ApiResponse<T>);
};

// ── Created ─────────────────────────────────────────────────────────────
export const sendCreated = <T>(
    res:      Response,
    data:     T,
    message = "Created successfully",
): Response => {
    return sendSuccess(res, data, message, 201);
};

// ── Paginated ────────────────────────────────────────────────────────────
export const sendPaginated = <T>(
    res:      Response,
    data:     T[],
    meta:     PaginationMeta,
    message = "Success",
): Response => {
    return res.status(200).json({
        success: true,
        message,
        data,
        meta,
    } satisfies ApiResponse<T[]>);
};

// ── No Content ───────────────────────────────────────────────────────────
export const sendNoContent = (res: Response): Response => {
    return res.status(204).send();
};

// ── Error ────────────────────────────────────────────────────────────────
export const sendError = (
    res:        Response,
    message:    string,
    statusCode = 500,
    errors?:    Record<string, string>,
): Response => {
    return res.status(statusCode).json({
        success: false,
        message,
        ...(errors && { errors }),
    } satisfies ApiResponse);   
};