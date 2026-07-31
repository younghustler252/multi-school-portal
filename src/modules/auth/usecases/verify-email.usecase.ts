import { IUserRepository }         from "../repositories/user.repository";
import { IOtpRepository }          from "../repositories/otp.repository";
import { OtpType }                 from "../../../generated/public";
import {
    AuthErrorMessage,
    OtpExpiryMinutes,
}                                  from "../domain/auth.enums";
import { BadRequestError, NotFoundError } from "../../../shared/errors/domain.errors";
import { VerifyEmailDtoType }      from "../dtos/otp.dto";

/*
|--------------------------------------------------------------------------
| VERIFY EMAIL USE CASE
| Flow:
| 1. Find user by email
| 2. Check not already verified
| 3. Find valid OTP for user
| 4. Check OTP attempts — block if too many
| 5. Compare OTP codes
| 6. Mark OTP as used
| 7. Mark user email as verified
|--------------------------------------------------------------------------
*/

interface Dependencies {
    userRepository: IUserRepository;
    otpRepository:  IOtpRepository;
}

export class VerifyEmailUseCase {
    private readonly userRepository: IUserRepository;
    private readonly otpRepository:  IOtpRepository;

    constructor({ userRepository, otpRepository }: Dependencies) {
        this.userRepository = userRepository;
        this.otpRepository  = otpRepository;
    }

    async execute(dto: VerifyEmailDtoType): Promise<{ message: string }> {

        // ── 1. Find user ─────────────────────────────────────────────────
        const user = await this.userRepository.findByEmail(dto.email);

        if (!user) {
            throw new NotFoundError("User");
        }

        // ── 2. Check not already verified ────────────────────────────────
        if (user.isEmailVerified) {
            return { message: "Email already verified. Please login." };
        }

        // ── 3. Find valid OTP ─────────────────────────────────────────────
        const otp = await this.otpRepository.findValid(
            user.id,
            OtpType.email_verification,
        );

        if (!otp) {
            throw new BadRequestError(AuthErrorMessage.INVALID_OTP);
        }

        // ── 4. Check max attempts ─────────────────────────────────────────
        if (otp.attempts >= 5) {
            throw new BadRequestError(AuthErrorMessage.OTP_MAX_ATTEMPTS);
        }

        // ── 5. Compare codes ──────────────────────────────────────────────
        if (otp.code !== dto.otp) {
            // Increment attempts before throwing
            await this.otpRepository.incrementAttempts(otp.id);
            throw new BadRequestError(AuthErrorMessage.INVALID_OTP);
        }

        // ── 6. Mark OTP as used ───────────────────────────────────────────
        await this.otpRepository.markUsed(otp.id);

        // ── 7. Mark user as verified ──────────────────────────────────────
        await this.userRepository.update(user.id, {
            isEmailVerified:  true,
            emailVerifiedAt:  new Date(),
        });
        
        return { message: "Email verified successfully. You can now login." };
    }
}