import { IUserRepository }       from "../repositories/user.repository";
import { IOtpRepository }        from "../repositories/otp.repository";
import { IRefreshTokenRepository } from "../repositories/refresh-token.repository";
import { PasswordService }       from "../../../shared/services/password.service";
import { OtpType }               from "../../../generated/prisma";
import {
    AuthErrorMessage,
}                                from "../domain/auth.enums";
import {
    BadRequestError,
    NotFoundError,
}                                from "../../../shared/errors/domain.errors";
import { ResetPasswordDtoType }  from "../dtos/password.dto";

/*
|--------------------------------------------------------------------------
| RESET PASSWORD USE CASE
| Flow:
| 1. Find user by email
| 2. Find valid OTP for user
| 3. Check OTP attempts — block if too many
| 4. Compare OTP codes
| 5. Validate new password strength
| 6. Hash new password
| 7. Mark OTP as used
| 8. Update user password
| 9. Invalidate all refresh tokens (force re-login on all devices)
| 10. Return success message
|--------------------------------------------------------------------------
*/

interface Dependencies {
    userRepository:         IUserRepository;
    otpRepository:          IOtpRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    passwordService:        PasswordService;
}

export class ResetPasswordUseCase {
    private readonly userRepository:         IUserRepository;
    private readonly otpRepository:          IOtpRepository;
    private readonly refreshTokenRepository: IRefreshTokenRepository;
    private readonly passwordService:        PasswordService;

    constructor({
        userRepository,
        otpRepository,
        refreshTokenRepository,
        passwordService,
    }: Dependencies) {
        this.userRepository         = userRepository;
        this.otpRepository          = otpRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordService        = passwordService;
    }

    async execute(
        dto: ResetPasswordDtoType,
    ): Promise<{ message: string }> {

        // ── 1. Find user by email ─────────────────────────────────────────
        const user = await this.userRepository.findByEmail(dto.email);

        if (!user) {
            throw new NotFoundError("User");
        }

        // ── 2. Find valid OTP ─────────────────────────────────────────────
        const otp = await this.otpRepository.findValid(
            user.id,
            OtpType.password_reset,
        );

        if (!otp) {
            throw new BadRequestError(AuthErrorMessage.INVALID_OTP);
        }

        // ── 3. Check max attempts ─────────────────────────────────────────
        if (otp.attempts >= 5) {
            throw new BadRequestError(AuthErrorMessage.OTP_MAX_ATTEMPTS);
        }

        // ── 4. Compare OTP codes ──────────────────────────────────────────
        if (otp.code !== dto.otp) {
            await this.otpRepository.incrementAttempts(otp.id);
            throw new BadRequestError(AuthErrorMessage.INVALID_OTP);
        }

        // ── 5. Validate new password strength ─────────────────────────────
        const passwordValidation = this.passwordService.validate(
            dto.newPassword,
        );

        if (!passwordValidation.valid) {
            throw new BadRequestError(
                passwordValidation.message ?? "Password is too weak",
            );
        }

        // ── 6. Hash new password ──────────────────────────────────────────
        const passwordHash = await this.passwordService.hash(dto.newPassword);

        // ── 7. Mark OTP as used ───────────────────────────────────────────
        await this.otpRepository.markUsed(otp.id);

        // ── 8. Update user password ───────────────────────────────────────
        await this.userRepository.update(user.id, {
            passwordHash,
            passwordChangedAt: new Date(),
            // Unlock account in case it was locked
            failedLoginCount:  0,
            lockedUntil:       null,
        });

        // ── 9. Invalidate all refresh tokens ──────────────────────────────
        // Forces re-login on all devices after password change
        await this.refreshTokenRepository.deleteByUserId(user.id);

        // ── 10. Return success ────────────────────────────────────────────
        return {
            message: "Password reset successfully. Please login with your new password.",
        };
    }
}