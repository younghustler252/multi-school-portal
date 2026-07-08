import { asClass }                     from "awilix";
import type { AwilixContainer }        from "awilix";

// ── Mapper ───────────────────────────────────────────────────────────────
import { UserMapper }                  from "./mappers/user.mapper";

// ── Repositories ─────────────────────────────────────────────────────────
import { UserRepositoryImpl }          from "./repositories/user.repository.impl";
import { OtpRepositoryImpl }           from "./repositories/otp.repository.impl";
import { RefreshTokenRepositoryImpl }  from "./repositories/refresh-token.repository.impl";

// ── Use Cases ─────────────────────────────────────────────────────────────
import { RegisterUseCase } from "./usecases/register.usecases";
import { VerifyEmailUseCase }          from "./usecases/verify-email.usecase";
import { LoginUseCase }                from "./usecases/login.usecase";
import { RefreshTokenUseCase }         from "./usecases/refresh-token.usecase";
import { LogoutUseCase }               from "./usecases/logout.usecase";
import { ForgotPasswordUseCase }       from "./usecases/forgot-password.usecase";
import { ResetPasswordUseCase }        from "./usecases/reset-password.usecase";
import { ResendOtpUseCase }            from "./usecases/resend-otp.usecase";

// ── Controller ────────────────────────────────────────────────────────────
import { AuthController }              from "./controllers/auth.controller";

/*
|--------------------------------------------------------------------------
| AUTH CONTAINER
| Registers all auth module dependencies into Awilix
|--------------------------------------------------------------------------
*/

export const registerAuth = (container: AwilixContainer): void => {
    container.register({

        // ── Mapper ───────────────────────────────────────────────────────
        userMapper:                  asClass(UserMapper).singleton(),

        // ── Repositories ─────────────────────────────────────────────────
        userRepository:              asClass(UserRepositoryImpl).scoped(),
        otpRepository:               asClass(OtpRepositoryImpl).scoped(),
        refreshTokenRepository:      asClass(RefreshTokenRepositoryImpl).scoped(),

        // ── Use Cases ─────────────────────────────────────────────────────
        registerUseCase: asClass(RegisterUseCase).scoped(),
        verifyEmailUseCase:          asClass(VerifyEmailUseCase).scoped(),
        loginUseCase:                asClass(LoginUseCase).scoped(),
        refreshTokenUseCase:         asClass(RefreshTokenUseCase).scoped(),
        logoutUseCase:               asClass(LogoutUseCase).scoped(),
        forgotPasswordUseCase:       asClass(ForgotPasswordUseCase).scoped(),
        resetPasswordUseCase:        asClass(ResetPasswordUseCase).scoped(),
        resendOtpUseCase:            asClass(ResendOtpUseCase).scoped(),

        // ── Controller ────────────────────────────────────────────────────
        authController:              asClass(AuthController).scoped(),
    });
};