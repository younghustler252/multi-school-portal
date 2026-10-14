import { Request, Response, NextFunction, CookieOptions } from "express";
import jwt                                 from "jsonwebtoken";
import { env }                             from "../../config/env";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors/domain.errors";
import { AccessTokenPayload, TokenService } from "../../shared/services/token.service";

/*
|--------------------------------------------------------------------------
| AUTH MIDDLEWARE
| Identity only: verifies the access token and sets req.auth.
| Roles and permissions are loaded afterwards by loadAccess / requirePermission
| (rbac.middleware.ts), after the tenant is resolved.
| Authorization header first (mobile), then cookie (web).
|--------------------------------------------------------------------------
*/

const tokens = new TokenService();

// Matched on whole path endings, so "/me/password-reset" is NOT exempt.
const PASSWORD_CHANGE_EXEMPT_SUFFIXES = ["/me/password", "/auth/logout"];

const isExemptRoute = (req: Request): boolean => {
    const path = req.originalUrl.split("?")[0].replace(/\/+$/, "");
    return PASSWORD_CHANGE_EXEMPT_SUFFIXES.some((suffix) => path.endsWith(suffix));
};

const extractToken = (req: Request): string | null => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) return authHeader.split(" ")[1];
    if (req.cookies?.accessToken) return req.cookies.accessToken;
    return null;
};

const attach = (req: Request, claims: AccessTokenPayload): void => {
    req.auth = {
        userId:             claims.sub,
        schoolId:           claims.tid,
        membershipId:       claims.mid,
        mustChangePassword: claims.mcp,
        impersonatedBy:     claims.imp,
    };
    // Transitional: controllers still read req.user. `role` is filled in by loadAccess.
    req.user = { id: claims.sub, schoolId: claims.tid, mustChangePassword: claims.mcp, role: null };
};

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
    try {
        const token = extractToken(req);
        if (!token) throw new UnauthorizedError("No token provided", "TOKEN_MISSING");

        attach(req, tokens.verifyAccessToken(token));

        if (req.auth!.mustChangePassword && !isExemptRoute(req)) {
            throw new ForbiddenError("You must change your password before continuing.", "MUST_CHANGE_PASSWORD");
        }

        next();
    } catch (err: any) {
        if (err instanceof jwt.TokenExpiredError) { next(new UnauthorizedError("Token expired", "TOKEN_EXPIRED")); return; }
        if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.NotBeforeError) { next(new UnauthorizedError("Invalid token", "TOKEN_INVALID")); return; }
        next(err);
    }
};

/*
|--------------------------------------------------------------------------
| OPTIONAL AUTH
| Attaches identity if a valid token is present, never blocks.
|--------------------------------------------------------------------------
*/
export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
    const token = extractToken(req);
    if (!token) return next();

    try {
        attach(req, tokens.verifyAccessToken(token));
    } catch {
        req.auth = undefined;
        req.user = undefined;
    }
    next();
};

/*
|--------------------------------------------------------------------------
| AUTH COOKIES
| set and clear use the SAME attributes; a cookie is only cleared when
| name, path and domain match how it was set.
| COOKIE_DOMAIN (env, optional): unset = host-only, one session per host.
| Set it (e.g. ".example.com") only if one login must work across subdomains.
| Tokens are bound to a school, so a shared cookie can never open another school.
|--------------------------------------------------------------------------
*/
const cookieBase = (): CookieOptions => ({
    httpOnly: true,
    secure:   env.NODE_ENV === "production",
    sameSite: "lax",   // "strict" would block the cookie during the post-login redirect
    path:     "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
    res.cookie("accessToken",  accessToken,  { ...cookieBase(), maxAge: 15 * 60 * 1000 });
    res.cookie("refreshToken", refreshToken, { ...cookieBase(), maxAge: 7 * 24 * 60 * 60 * 1000 });
};

export const clearAuthCookies = (res: Response): void => {
    res.clearCookie("accessToken",  cookieBase());
    res.clearCookie("refreshToken", cookieBase());
};