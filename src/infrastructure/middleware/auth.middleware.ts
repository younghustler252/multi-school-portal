import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { UnauthorizedError } from "../../shared/errors/domain.error";

/*
|--------------------------------------------------------------------------
| AUTH MIDDLEWARE
| Verifies JWT access token on protected routes
| Attaches decoded user payload to req.user
|--------------------------------------------------------------------------
*/

interface JwtPayload {
    id:       string;
    email:    string;
    role:     string;
    schoolId: string | null;
}

export const authenticate = (
    req:  Request,
    res:  Response,
    next: NextFunction,
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new UnauthorizedError("No token provided");
        }

        const token   = authHeader.split(" ")[1];
        const decoded = jwt.verify(
            token,
            env.jwt.accessSecret,
        ) as JwtPayload;

        req.user = {
            id:       decoded.id,
            email:    decoded.email,
            role:     decoded.role as any,
            schoolId: decoded.schoolId,
        };

        next();
    } catch (err: any) {
        if (err.name === "TokenExpiredError") {
            next(new UnauthorizedError("Token expired"));
            return;
        }

        if (err.name === "JsonWebTokenError") {
            next(new UnauthorizedError("Invalid token"));
            return;
        }

        next(err);
    }
};

/*
|--------------------------------------------------------------------------
| OPTIONAL AUTH
| Attaches user if token present but doesn't block if missing
| Useful for routes that behave differently for logged in users
|--------------------------------------------------------------------------
*/
export const optionalAuthenticate = (
    req:  Request,
    res:  Response,
    next: NextFunction,
): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
    }

    authenticate(req, res, next);
};