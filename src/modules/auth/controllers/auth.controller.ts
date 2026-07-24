import { Request, Response, NextFunction } from "express";
import { RegisterUseCase } from "../usecases/register.usecases";
import { VerifyEmailUseCase }              from "../usecases/verify-email.usecase";
import { LoginUseCase }                    from "../usecases/login.usecase";
import { RefreshTokenUseCase }             from "../usecases/refresh-token.usecase";
import { LogoutUseCase }                   from "../usecases/logout.usecase";
import { ForgotPasswordUseCase }           from "../usecases/forgot-password.usecase";
import { ResetPasswordUseCase }            from "../usecases/reset-password.usecase";
import { ResendOtpUseCase }                from "../usecases/resend-otp.usecase";
// Add imports
import { ValidateInviteUseCase } from "../usecases/validate-invite.usecase";
import { AcceptInviteUseCase }   from "../usecases/accept-invite.usecase";
import { SendInviteUseCase }     from "../usecases/send-invite.usecase";
import { ValidateInviteDto, AcceptInviteDto } from "../dtos/invite.dto";
import { Role }                  from "../../../generated/prisma/client";

import {
    setAuthCookies,
    clearAuthCookies,
}                                          from "../../../infrastructure/middleware/auth.middleware";
import {
    sendSuccess,
    sendCreated,
}                                          from "../../../shared/utils/api-response";

/*
|--------------------------------------------------------------------------
| AUTH CONTROLLER
| Parses request → calls use case → sends response
| No business logic here — only HTTP concerns
|--------------------------------------------------------------------------
*/

interface Dependencies {
    verifyEmailUseCase:    VerifyEmailUseCase;
    loginUseCase:          LoginUseCase;
    refreshTokenUseCase:   RefreshTokenUseCase;
    logoutUseCase:         LogoutUseCase;
    forgotPasswordUseCase: ForgotPasswordUseCase;
    resetPasswordUseCase:  ResetPasswordUseCase;
    resendOtpUseCase:      ResendOtpUseCase;
    registerUseCase: RegisterUseCase;

    validateInviteUseCase: ValidateInviteUseCase;
    acceptInviteUseCase:   AcceptInviteUseCase;
    sendInviteUseCase:     SendInviteUseCase;


}

export class AuthController {
    private readonly registerUseCase: RegisterUseCase;
    private readonly verifyEmailUseCase:    VerifyEmailUseCase;
    private readonly loginUseCase:          LoginUseCase;
    private readonly refreshTokenUseCase:   RefreshTokenUseCase;
    private readonly logoutUseCase:         LogoutUseCase;
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase;
    private readonly resetPasswordUseCase:  ResetPasswordUseCase;
    private readonly resendOtpUseCase:      ResendOtpUseCase;

    private readonly validateInviteUseCase:      ValidateInviteUseCase;
    private readonly acceptInviteUseCase:      AcceptInviteUseCase;
    private readonly sendInviteUseCase:      SendInviteUseCase;


    constructor({
        registerUseCase,
        verifyEmailUseCase,
        loginUseCase,
        refreshTokenUseCase,
        logoutUseCase,
        forgotPasswordUseCase,
        resetPasswordUseCase,
        resendOtpUseCase,

        validateInviteUseCase,
        sendInviteUseCase,
        acceptInviteUseCase
    }: Dependencies) {
        this.registerUseCase       = registerUseCase;
        this.verifyEmailUseCase    = verifyEmailUseCase;
        this.loginUseCase          = loginUseCase;
        this.refreshTokenUseCase   = refreshTokenUseCase;
        this.logoutUseCase         = logoutUseCase;
        this.forgotPasswordUseCase = forgotPasswordUseCase;
        this.resetPasswordUseCase  = resetPasswordUseCase;
        this.resendOtpUseCase      = resendOtpUseCase;

        this.validateInviteUseCase = validateInviteUseCase;
        this.acceptInviteUseCase = acceptInviteUseCase;
        this.sendInviteUseCase = sendInviteUseCase;
    }

    register = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.registerUseCase.execute(req.body);
            sendCreated(res, null, result.message);
        } catch (err) {
            next(err);
        }
    };
    // ── Verify email ──────────────────────────────────────────────────────
    verifyEmail = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.verifyEmailUseCase.execute(req.body);
            sendSuccess(res, result, result.message);
        } catch (err) {
            next(err);
        }
    };

    // ── Login ─────────────────────────────────────────────────────────────
    login = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const ip     = req.ip ?? req.socket.remoteAddress ?? "unknown";
            const result = await this.loginUseCase.execute(req.body, ip);

            // Set HttpOnly cookies for web clients
            setAuthCookies(
                res,
                result.tokens.accessToken,
                result.tokens.refreshToken,
            );

            sendSuccess(res, result, "Login successful");
        } catch (err) {
            next(err);
        }
    };

    // ── Refresh token ─────────────────────────────────────────────────────
    refreshToken = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            // Token comes from cookie (web) or request body (mobile)
            const refreshToken =
                req.cookies?.refreshToken ?? req.body?.refreshToken;

            const result = await this.refreshTokenUseCase.execute(refreshToken);

            // Rotate cookies for web clients
            setAuthCookies(
                res,
                result.tokens.accessToken,
                result.tokens.refreshToken,
            );

            sendSuccess(res, result, "Token refreshed successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Logout ────────────────────────────────────────────────────────────
    logout = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            // Token comes from cookie (web) or request body (mobile)
            const refreshToken =
                req.cookies?.refreshToken ?? req.body?.refreshToken;

            await this.logoutUseCase.execute(refreshToken);

            // Clear cookies for web clients
            clearAuthCookies(res);

            sendSuccess(res, null, "Logged out successfully");
        } catch (err) {
            next(err);
        }
    };

    // ── Forgot password ───────────────────────────────────────────────────
    forgotPassword = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.forgotPasswordUseCase.execute(req.body);
            sendSuccess(res, null, result.message);
        } catch (err) {
            next(err);
        }
    };

    // ── Reset password ────────────────────────────────────────────────────
    resetPassword = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.resetPasswordUseCase.execute(req.body);
            sendSuccess(res, null, result.message);
        } catch (err) {
            next(err);
        }
    };

    // ── Resend OTP ────────────────────────────────────────────────────────
    resendOtp = async (
        req:  Request,
        res:  Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.resendOtpUseCase.execute(req.body);
            sendSuccess(res, null, result.message);
        } catch (err) {
            next(err);
        }
    };

        
    validateInvite = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.validateInviteUseCase.execute(req.body);
            sendSuccess(res, result, "Invite is valid");
        } catch (err) { next(err); }
    };

    acceptInvite = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.acceptInviteUseCase.execute(req.body);

            // Auto-login after accepting invite
            setAuthCookies(
                res,
                result.tokens.accessToken,
                result.tokens.refreshToken,
            );

            sendCreated(res, result, "Account created successfully. Welcome!");
        } catch (err) { next(err); }
    };

    sendInvite = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.sendInviteUseCase.execute({
                email:    req.body.email,
                role:     req.body.role as Role,
                schoolId: req.user!.schoolId!,
                sentById: req.user!.id,
            });
            sendSuccess(res, null, result.message);
        } catch (err) { next(err); }
    };
}