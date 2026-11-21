import { Request, Response, NextFunction } from "express";
import { ZodSchema }                       from "zod";

/*
|--------------------------------------------------------------------------
| VALIDATE MIDDLEWARE
| Validates request body, params, or query against a Zod schema.
| Usage: router.post("/", validate(createUserDto), controller.create)
|
| - A failure goes to the global error handler, so it has the same envelope as every other
|   error: 400 { success:false, message:"Validation failed", code:"VALIDATION_ERROR", errors:{ "field.path": "message" } }.
| - The PARSED result (defaults applied, coerced, transformed, unknown keys stripped) is stored for the controller:
|     body   -> req.body                (writable)
|     params -> req.params              (writable)
|     query  -> res.locals.validated.query   (Express 5's req.query is a getter and cannot be reassigned)
|   Read it with validated(res, "query", req.query). Raw req.query still holds the unparsed strings.
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
            next(result.error);          // ZodError -> errorHandler (code VALIDATION_ERROR)
            return;
        }

        res.locals.validated = { ...(res.locals.validated ?? {}), [part]: result.data };
        if (part === "body") req.body = result.data;
        else if (part === "params") req.params = result.data as Request["params"];

        next();
    };
};

/** The parsed body/params/query of a route that used validate(); `fallback` (the raw value) if it did not. */
export function validated<T = Record<string, unknown>>(res: Response, part: RequestPart, fallback?: unknown): T {
    return ((res.locals.validated ?? {})[part] ?? fallback) as T;
}
