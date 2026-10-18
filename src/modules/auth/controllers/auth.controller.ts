import { Request, Response, NextFunction } from "express";
import { RegisterUseCase } from "../usecases/register.usecase";
import { VerifyEmailUseCase } from "../usecases/verify-email.usecase";
import { LoginUseCase }          from "../usecases/login.usecase";
import { RefreshTokenUseCase }   from "../usecases/refresh-token.usecase";
import { LogoutUseCase }         from "../usecases/logout.usecase";
import { ForgotPasswordUseCase } from "../usecases/forgot-password.usecase";
import { ResetPasswordUseCase }  from "../usecases/reset-password.usecase";
import { ResendOtpUseCase }      from "../usecases/resend-otp.usecase";
import { SwitchPersonaUseCase }  from "../usecases/switch-persona.usecase";
import { ValidateInviteUseCase } from "../usecases/validate-invite.usecase";
import { AcceptInviteUseCase }   from "../usecases/accept-invite.usecase";
import { SendInviteUseCase }     from "../usecases/send-invite.usecase";
import { ManageInvitesUseCase }  from "../usecases/manage-invites.usecase";
import { ExchangeImpersonationTokenUseCase } from "../usecases/exchange-impersonation-token.usecase";
import { setAuthCookies, clearAuthCookies }  from "../../../infrastructure/middleware/auth.middleware";
import { getAccess }             from "../../../infrastructure/middleware/rbac.middleware";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { AuthMessage }           from "../domain/auth.enums";
import { authErrors } from "../domain/auth.errors";
import { InviteActor, RequestMeta, LoginResult } from "../types/auth.types";

interface Dependencies {
    registerUseCase:       RegisterUseCase;
    verifyEmailUseCase:    VerifyEmailUseCase;
    loginUseCase:          LoginUseCase;
    refreshTokenUseCase:   RefreshTokenUseCase;
    logoutUseCase:         LogoutUseCase;
    forgotPasswordUseCase: ForgotPasswordUseCase;
    resetPasswordUseCase:  ResetPasswordUseCase;
    resendOtpUseCase:      ResendOtpUseCase;
    switchPersonaUseCase:  SwitchPersonaUseCase;
    validateInviteUseCase: ValidateInviteUseCase;
    acceptInviteUseCase:   AcceptInviteUseCase;
    sendInviteUseCase:     SendInviteUseCase;
    manageInvitesUseCase:  ManageInvitesUseCase;
    exchangeImpersonationTokenUseCase: ExchangeImpersonationTokenUseCase;
}

/*
|--------------------------------------------------------------------------
| AUTH CONTROLLER — HTTP concerns only
|--------------------------------------------------------------------------
*/

// The school the request host resolved to, or null on the platform host
const hostSchoolId = (req: Request): string | null =>
    req.schoolId && req.schoolId !== "PUBLIC" ? req.schoolId : null;

const metaOf = (req: Request): RequestMeta => ({
    ip:        req.ip ?? req.socket.remoteAddress ?? "unknown",
    userAgent: req.get("user-agent") ?? null,
});

// authenticate() sets req.auth = { userId, schoolId, membershipId, mustChangePassword, impersonatedBy }
const authOf = (req: Request) => {
    if (!req.auth) throw authErrors.refreshInvalid();
    return req.auth;
};

const requireSchoolHost = (req: Request): string => {
    const id = hostSchoolId(req);
    if (!id) throw authErrors.badRequest("This action must be done on a school's own address");
    return id;
};

const refreshTokenOf = (req: Request): string | undefined =>
    req.cookies?.refreshToken ?? req.body?.refreshToken;

export class AuthController {
    constructor(private readonly d: Dependencies) {}

    private actor(req: Request): InviteActor {
        const access = getAccess(req);
        const a      = authOf(req);
        return {
            userId:       a.userId,
            membershipId: a.membershipId,
            isAdmin:      access.hasRoleKey("school_admin"),
            can:          (key: string) => access.can(key),
        };
    }

    private respondSession(res: Response, result: LoginResult, message: string, created = false): void {
        if (result.status === "AUTHENTICATED") {
            setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
        }
        created ? sendCreated(res, result, message) : sendSuccess(res, result, message);
    }

    register = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.registerUseCase.execute(req.body, metaOf(req));
            sendCreated(res, { subdomain: r.subdomain }, r.message);
        } catch (e) { next(e); }
    };

    verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.verifyEmailUseCase.execute(req.body, metaOf(req));
            sendSuccess(res, { workspace: r.workspace }, r.message);
        } catch (e) { next(e); }
    };

    login = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.loginUseCase.execute(req.body, metaOf(req), hostSchoolId(req));
            this.respondSession(res, r, AuthMessage.LOGIN_OK);
        } catch (e) { next(e); }
    };

    refreshToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.refreshTokenUseCase.execute(refreshTokenOf(req), hostSchoolId(req), metaOf(req));
            this.respondSession(res, r, "Token refreshed successfully");
        } catch (e) { next(e); }
    };

    logout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.d.logoutUseCase.execute(refreshTokenOf(req), metaOf(req));
            clearAuthCookies(res);
            sendSuccess(res, null, AuthMessage.LOGGED_OUT);
        } catch (e) { next(e); }
    };

    logoutAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // An impersonating platform user must never sign the REAL user out everywhere:
            // in that case only the current session ends.
            if (authOf(req).impersonatedBy) await this.d.logoutUseCase.execute(refreshTokenOf(req), metaOf(req));
            else await this.d.logoutUseCase.executeAll(authOf(req).userId, hostSchoolId(req), metaOf(req));
            clearAuthCookies(res);
            sendSuccess(res, null, AuthMessage.LOGGED_OUT);
        } catch (e) { next(e); }
    };

    forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.forgotPasswordUseCase.execute(req.body);
            sendSuccess(res, null, r.message);
        } catch (e) { next(e); }
    };

    resetPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.resetPasswordUseCase.execute(req.body, metaOf(req), hostSchoolId(req) !== null);
            clearAuthCookies(res);
            sendSuccess(res, null, r.message);
        } catch (e) { next(e); }
    };

    resendOtp = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.resendOtpUseCase.execute(req.body);
            sendSuccess(res, null, r.message);
        } catch (e) { next(e); }
    };

    switchPersona = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const auth = authOf(req);
            if (auth.impersonatedBy) throw authErrors.personaUnavailable(); // no profile switching while impersonating
            const r = await this.d.switchPersonaUseCase.execute(
                auth.userId, requireSchoolHost(req), req.body.persona, metaOf(req),
            );
            this.respondSession(res, r, "Profile switched");
        } catch (e) { next(e); }
    };

    exchangeImpersonationToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.exchangeImpersonationTokenUseCase.execute(
                req.body.ticket, requireSchoolHost(req), metaOf(req),
            );
            this.respondSession(res, r, "Session established");
        } catch (e) { next(e); }
    };

    // ── Invites ──────────────────────────────────────────────────────────
    validateInvite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            sendSuccess(res, await this.d.validateInviteUseCase.execute(req.body, requireSchoolHost(req)), "Invite is valid");
        } catch (e) { next(e); }
    };

    acceptInvite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.acceptInviteUseCase.execute(req.body, requireSchoolHost(req), metaOf(req));
            this.respondSession(res, r, "Account ready. Welcome!", true);
        } catch (e) { next(e); }
    };

    sendInvite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.sendInviteUseCase.execute(req.body, requireSchoolHost(req), this.actor(req), metaOf(req));
            sendCreated(res, { inviteId: r.inviteId, expiresAt: r.expiresAt }, r.message);
        } catch (e) { next(e); }
    };

    listInvites = async (req: Request, res: Response, next: NextFunction) => {
        try {
            sendSuccess(res, await this.d.manageInvitesUseCase.list(requireSchoolHost(req)), "Pending invitations");
        } catch (e) { next(e); }
    };

    revokeInvite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.manageInvitesUseCase.revoke(String(req.params.id), requireSchoolHost(req), this.actor(req), metaOf(req));
            sendSuccess(res, null, r.message);
        } catch (e) { next(e); }
    };

    resendInvite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.manageInvitesUseCase.resend(String(req.params.id), requireSchoolHost(req), this.actor(req), metaOf(req));
            sendSuccess(res, { expiresAt: r.expiresAt }, r.message);
        } catch (e) { next(e); }
    };
}
