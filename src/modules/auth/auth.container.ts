import { asClass }          from "awilix";
import type { AwilixContainer } from "awilix";

import { UserMapper }                   from "./mappers/user.mapper";
import { UserRepositoryImpl }           from "./repositories/user.repository.impl";
import { OtpRepositoryImpl }            from "./repositories/otp.repository.impl";
import { RefreshTokenRepositoryImpl }   from "./repositories/refresh-token.repository.impl";
import { InviteRepositoryImpl }         from "./repositories/invite.repository.impl";

import { TokenHashService }    from "./services/token-hash.service";
import { AuthSessionService }  from "./services/auth-session.service";
import { LoginAttemptService } from "./services/login-attempt.service";
import { AuthPolicyService }   from "./services/auth-policy.service";
import { AuthAuditService }    from "./services/auth-audit.service";
import { AuthMessageService }  from "./services/auth-message.service";
import { OtpService }          from "./services/otp.service";
import { MembershipService }   from "./services/membership.service";
import { InviteService }       from "./services/invite.service";
import { UrlService }          from "../../shared/services/url.service";

import { RegisterUseCase }       from "./usecases/register.usecase";
import { VerifyEmailUseCase }    from "./usecases/verify-email.usecase";
import { LoginUseCase }          from "./usecases/login.usecase";
import { RefreshTokenUseCase }   from "./usecases/refresh-token.usecase";
import { LogoutUseCase }         from "./usecases/logout.usecase";
import { ForgotPasswordUseCase } from "./usecases/forgot-password.usecase";
import { ResetPasswordUseCase }  from "./usecases/reset-password.usecase";
import { ResendOtpUseCase }      from "./usecases/resend-otp.usecase";
import { SwitchPersonaUseCase }  from "./usecases/switch-persona.usecase";
import { ValidateInviteUseCase } from "./usecases/validate-invite.usecase";
import { AcceptInviteUseCase }   from "./usecases/accept-invite.usecase";
import { SendInviteUseCase }     from "./usecases/send-invite.usecase";
import { ManageInvitesUseCase }  from "./usecases/manage-invites.usecase";
import { ExchangeImpersonationTokenUseCase } from "./usecases/exchange-impersonation-token.usecase";

import { AuthController } from "./controllers/auth.controller";

/*
|--------------------------------------------------------------------------
| AUTH CONTAINER
| Requires from registerShared: prismaClient, tokenService, passwordService,
| mailService. Requires planRepository (plans module) for the free plan.
| urlService is registered here for now; move it to registerShared when convenient.
| Services that hold no per-request state are singletons; anything that reads
| the tenant context (membership, policy) or request data is scoped.
|--------------------------------------------------------------------------
*/

export const registerAuth = (container: AwilixContainer): void => {
    container.register({
        // Mapper + shared helpers
        userMapper:          asClass(UserMapper).singleton(),
        tokenHashService:    asClass(TokenHashService).singleton(),
        urlService:          asClass(UrlService).singleton(),

        // Repositories
        userRepository:         asClass(UserRepositoryImpl).scoped(),
        otpRepository:          asClass(OtpRepositoryImpl).scoped(),
        refreshTokenRepository: asClass(RefreshTokenRepositoryImpl).scoped(),
        inviteRepository:       asClass(InviteRepositoryImpl).scoped(),

        // Services
        authSessionService:  asClass(AuthSessionService).scoped(),
        loginAttemptService: asClass(LoginAttemptService).scoped(),
        authPolicyService:   asClass(AuthPolicyService).scoped(),
        authAuditService:    asClass(AuthAuditService).scoped(),
        authMessageService:  asClass(AuthMessageService).scoped(),
        otpService:          asClass(OtpService).scoped(),
        membershipService:   asClass(MembershipService).scoped(),
        inviteService:       asClass(InviteService).scoped(),

        // Use cases
        registerUseCase:       asClass(RegisterUseCase).scoped(),
        verifyEmailUseCase:    asClass(VerifyEmailUseCase).scoped(),
        loginUseCase:          asClass(LoginUseCase).scoped(),
        refreshTokenUseCase:   asClass(RefreshTokenUseCase).scoped(),
        logoutUseCase:         asClass(LogoutUseCase).scoped(),
        forgotPasswordUseCase: asClass(ForgotPasswordUseCase).scoped(),
        resetPasswordUseCase:  asClass(ResetPasswordUseCase).scoped(),
        resendOtpUseCase:      asClass(ResendOtpUseCase).scoped(),
        switchPersonaUseCase:  asClass(SwitchPersonaUseCase).scoped(),
        validateInviteUseCase: asClass(ValidateInviteUseCase).scoped(),
        acceptInviteUseCase:   asClass(AcceptInviteUseCase).scoped(),
        sendInviteUseCase:     asClass(SendInviteUseCase).scoped(),
        manageInvitesUseCase:  asClass(ManageInvitesUseCase).scoped(),
        exchangeImpersonationTokenUseCase: asClass(ExchangeImpersonationTokenUseCase).scoped(),

        // Controller
        authController: asClass(AuthController).scoped(),
    });
};
