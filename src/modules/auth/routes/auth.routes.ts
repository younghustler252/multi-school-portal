import { Router }           from "express";
import { container }        from "../../../container";
import { AuthController }   from "../controllers/auth.controller";
import { validate }         from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }     from "../../../infrastructure/middleware/auth.middleware";
import { requireSchoolAdmin } from "../../../infrastructure/middleware/rbac.middleware";
import {
    authLimiter,
    otpLimiter,
}                              from "../../../infrastructure/middleware/rate-limit.middleware";
import { LoginDto }         from "../dtos/login.dto";
import {
    VerifyEmailDto,
    ResendOtpDto,
}                           from "../dtos/otp.dto";
import {
    ForgotPasswordDto,
    ResetPasswordDto,
}                           from "../dtos/password.dto";

import { RegisterDto } from "../dtos/register.dto";
import {
    ValidateInviteDto,
    AcceptInviteDto,
}                          from "../dtos/invite.dto";


/*
|--------------------------------------------------------------------------
| AUTH ROUTES
|--------------------------------------------------------------------------
*/

const router = Router();

// ── Lazy resolve controller ───────────────────────────────────────────────
// Resolved on first request, not at import time
// This ensures container is fully built before resolution
const ctrl = () => container.resolve<AuthController>("authController");

// ── Public routes ─────────────────────────────────────────────────────────
router.post(
    "/register",
    authLimiter,
    validate(RegisterDto),
    (req, res, next) => ctrl().register(req, res, next),
);

router.post(
    "/verify-email",
    authLimiter,
    validate(VerifyEmailDto),
    (req, res, next) => ctrl().verifyEmail(req, res, next),
);

router.post(
    "/login",
    authLimiter,
    validate(LoginDto),
    (req, res, next) => ctrl().login(req, res, next),
);

router.post(
    "/refresh",
    
    (req, res, next) => ctrl().refreshToken(req, res, next),
);

router.post(
    "/forgot-password",
    otpLimiter,
    validate(ForgotPasswordDto),
    (req, res, next) => ctrl().forgotPassword(req, res, next),
);

router.post(
    "/reset-password",
    otpLimiter,
    validate(ResetPasswordDto),
    (req, res, next) => ctrl().resetPassword(req, res, next),
);

router.post(
    "/resend-otp",
    authLimiter,
    validate(ResendOtpDto),
    (req, res, next) => ctrl().resendOtp(req, res, next),
);

// ── Protected routes ──────────────────────────────────────────────────────
router.post(
    "/logout",
    authenticate,
    (req, res, next) => ctrl().logout(req, res, next),
);

// Validate token before showing accept form
router.post(
    "/invite/validate",
    validate(ValidateInviteDto),
    (req, res, next) => ctrl().validateInvite(req, res, next),
);

// Accept invite + create account
router.post(
    "/invite/accept",
    authLimiter,
    validate(AcceptInviteDto),
    (req, res, next) => ctrl().acceptInvite(req, res, next),
);

// ── Protected — school admin sends invite ─────────────────────────────────
router.post(
    "/invite/send",
    authenticate,
    requireSchoolAdmin,
    (req, res, next) => ctrl().sendInvite(req, res, next),
);

export default router;