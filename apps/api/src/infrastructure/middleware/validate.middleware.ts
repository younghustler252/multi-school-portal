import { Request, Response, NextFunction } from "express";
import { ZodSchema }                       from "zod";

/*
|--------------------------------------------------------------------------
| VALIDATE MIDDLEWARE
| Validates request body, params, or query against a Zod schema
| Usage: router.post("/", validate(createUserDto), controller.create)
|--------------------------------------------------------------------------
*/
type RequestPart = "body" | "params" | "query";

export const validate = (
    schema: ZodSchema,
    part:   RequestPart = "body",
) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[part]);

        if (!result.success) {
            const errors = result.error.flatten().fieldErrors;
            res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
            return;
        }

        // ── Fix: can't reassign req.query directly ────────────────────────
        if (part === "body") {
            req.body = result.data;
        } else if (part === "params") {
        }
       

        next();
    };
};