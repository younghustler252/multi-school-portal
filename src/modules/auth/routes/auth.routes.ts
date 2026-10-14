import { Router }          from "express";
import { container }       from "../../../container";
import { AuthController }  from "../controllers/auth.controller";
import { validate }        from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }    from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant }   from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { authLimiter, otpLimiter } from "../../../infrastructure/middleware/rate-limit.middleware";
import { LoginDto, SwitchPersonaDto, ImpersonationExchangeDto } from "../dtos/login.dto";
import { RegisterDto }     from "../dtos/register.dto";
import { VerifyEmailDto, ResendOtpDto } from "../dtos/otp.dto";
import { ForgotPasswordDto, ResetPasswordDto } from "../dtos/password.dto";
import { ValidateInviteDto, AcceptInviteDto, SendInviteDto } from "../dtos/invite.dto";

/*
|--------------------------------------------------------------------------
| AUTH ROUTES
| authLimiter / otpLimiter are still the IP-based limiters (defect D9). Login
| and invite-accept additionally throttle per (email + IP) inside the use cases.
| Order on every route: limiter, authenticate, permission, validate, controller.
|--------------------------------------------------------------------------
*/

const router = Router();
const ctrl   = () => container.resolve<AuthController>("authController");

// ── Public: account lifecycle ─────────────────────────────────────────────
router.post("/register",        authLimiter, validate(RegisterDto),       (q, s, n) => ctrl().register(q, s, n));
router.post("/verify-email",    otpLimiter,  validate(VerifyEmailDto),    (q, s, n) => ctrl().verifyEmail(q, s, n));
router.post("/resend-otp",      otpLimiter,  validate(ResendOtpDto),      (q, s, n) => ctrl().resendOtp(q, s, n));
router.post("/forgot-password", otpLimiter,  validate(ForgotPasswordDto),(q, s, n) => ctrl().forgotPassword(q, s, n));
router.post("/reset-password",  otpLimiter,  validate(ResetPasswordDto),  (q, s, n) => ctrl().resetPassword(q, s, n));

// ── Public: sessions ──────────────────────────────────────────────────────
router.post("/login",   authLimiter, validate(LoginDto), (q, s, n) => ctrl().login(q, s, n));
router.post("/refresh", authLimiter,                     (q, s, n) => ctrl().refreshToken(q, s, n));
// Needs no access token: the refresh token identifies the session (works after the access token expired)
router.post("/logout",  authLimiter,                     (q, s, n) => ctrl().logout(q, s, n));

router.post("/exchange-impersonation-token",
    authLimiter, requireTenant, validate(ImpersonationExchangeDto),
    (q, s, n) => ctrl().exchangeImpersonationToken(q, s, n),
);

// ── Authenticated ─────────────────────────────────────────────────────────
router.post("/logout-all", authenticate, (q, s, n) => ctrl().logoutAll(q, s, n));
router.post("/switch-persona",
    authenticate, requireTenant, validate(SwitchPersonaDto),
    (q, s, n) => ctrl().switchPersona(q, s, n),
);

// ── Invites: the invitee (public, on the school's own host) ───────────────
router.post("/invite/validate", authLimiter, requireTenant, validate(ValidateInviteDto), (q, s, n) => ctrl().validateInvite(q, s, n));
router.post("/invite/accept",   authLimiter, requireTenant, validate(AcceptInviteDto),   (q, s, n) => ctrl().acceptInvite(q, s, n));

// ── Invites: school staff (permission users.invite) ───────────────────────
router.post("/invite/send",
    authenticate, requireTenant, requirePermission("users.invite"), validate(SendInviteDto),
    (q, s, n) => ctrl().sendInvite(q, s, n),
);
router.get("/invites",
    authenticate, requireTenant, requirePermission("users.invite"),
    (q, s, n) => ctrl().listInvites(q, s, n),
);
router.post("/invites/:id/revoke",
    authenticate, requireTenant, requirePermission("users.invite"),
    (q, s, n) => ctrl().revokeInvite(q, s, n),
);
router.post("/invites/:id/resend",
    authenticate, requireTenant, requirePermission("users.invite"),
    (q, s, n) => ctrl().resendInvite(q, s, n),
);

export default router;
