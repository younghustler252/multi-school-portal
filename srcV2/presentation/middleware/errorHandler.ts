// errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../../shared/errors/AppError";
import { sendError } from "../../shared/utils/response";
import { HttpStatusCode } from "../../shared/utils/response";


export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof AppError) {
        return sendError(res, err.statusCode as HttpStatusCode, err.message);
    }

    console.error(err); // Programmer error
    return sendError(res, 500, "Internal Server Error");
};
