import { Request, Response, NextFunction } from "express";
import jwt                                 from "jsonwebtoken";
import { env }                             from "../../config/env";
import { UnauthorizedError } from "../../shared/errors/domain.errors";
/*
|--------------------------------------------------------------------------
| AUTH MIDDLEWARE
| Verifies JWT access token on protected routes
| Checks Authorization header first (mobile), then cookie (web)
|--------------------------------------------------------------------------
*/

interface JwtPayload {
    id:       string;
    email:    string;
    role:     string;
    schoolId: string | null;
}

const extractToken = (req: Request): string | null => {
    // 1. Check Authorization header (mobile / Postman)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.split(" ")[1];
    }

    // 2. Check HttpOnly cookie (web / Next.js)
    if (req.cookies?.accessToken) {
        return req.cookies.accessToken;
    }

    return null;
};

export const authenticate = (
    req:  Request,
    res:  Response,
    next: NextFunction,
): void => {
    try {
        const token = extractToken(req);

        if (!token) {
            throw new UnauthorizedError("No token provided");
        }

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
|--------------------------------------------------------------------------
*/


export const optionalAuthenticate = (
    req:  Request,
    res:  Response,
    next: NextFunction,
): void => {
    const token = extractToken(req);

    if (!token) return next();

    try {
        // Run a safe inline verification instead of calling the strict authenticate middleware
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

        return next();
    } catch (err) {
        // Silently swallow TokenExpiredError or JsonWebTokenError 
        // We wipe out any residual user state and let them hit public routes like /login
        req.user = undefined;
        return next();
    }
};


/*
|--------------------------------------------------------------------------
| CLEAR AUTH COOKIES
| Called on logout
|--------------------------------------------------------------------------
*/
export const clearAuthCookies = (res: Response): void => {
    res.clearCookie("accessToken",  { httpOnly: true, sameSite: "strict" });
    res.clearCookie("refreshToken", { httpOnly: true, sameSite: "strict" });
};

/*
|--------------------------------------------------------------------------
| SET AUTH COOKIES
| Called after login/register — sets tokens in HttpOnly cookies
|--------------------------------------------------------------------------
*/
export const setAuthCookies = (
    res:          Response,
    accessToken:  string,
    refreshToken: string,
): void => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure:   env.NODE_ENV === "production",
        sameSite: "lax", // "strict" would block the cookie during the redirect itself
        domain:   env.NODE_ENV === "production" ? ".schoolportal.com" : undefined,
        maxAge:   15 * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure:   env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge:   7 * 24 * 60 * 60 * 1000,    // 7 days
    });
};