import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { RequestContext } from "../../shared/context/request-context";

/*
| REQUEST CONTEXT MIDDLEWARE. Mount it FIRST at app level (before resolveTenant):  app.use(requestContext)
| It gives every request an id (a caller-supplied x-request-id is kept if it is a safe short string) and returns it in the
| x-request-id response header, so a user can quote it and you can find every log line and audit entry of that request.
*/
export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
    const supplied = req.get("x-request-id");
    const requestId = supplied && /^[A-Za-z0-9._-]{8,64}$/.test(supplied) ? supplied : randomUUID();
    res.setHeader("x-request-id", requestId);
    RequestContext.run(
        { requestId, ip: req.ip ?? req.socket.remoteAddress ?? "unknown", userAgent: req.get("user-agent") ?? null },
        () => next(),
    );
};
