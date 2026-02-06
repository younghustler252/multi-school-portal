// middlewares/validate.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { AppError } from "../utils/AppError";

export const validate =
    (schema: ZodSchema) =>
    (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const message = result.error.issues
                .map(issue => issue.message)
                .join(", ");

            throw new AppError(message, 422);
        }

        req.body = result.data; // sanitized data
        next();
    };
