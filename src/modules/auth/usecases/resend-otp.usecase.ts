import { IUserRepository }     from "../repositories/user.repository";
import { IOtpRepository }      from "../repositories/otp.repository";
import { MailService }         from "../../../infrastructure/mail/mail.service";
import { TokenService }        from "../../../shared/services/token.service";
import { OtpType }             from "../../../generated/prisma/enums";
import {
    OtpExpiryMinutes,
    AuthErrorMessage,
}                              from "../domain/auth.enums";
import {
    BadRequestError,
    NotFoundError,
}                              from "../../../shared/errors/domain.errors";
import { ResendOtpDtoType }    from "../dtos/otp.dto";

/*
|--------------------------------------------------------------------------
| RESEND OTP USE CASE
| Flow:
| 1. Find user by email
| 2. Check user exists and is active
| 3. Check not already verified (for email verification type)
| 4. Delete existing OTPs of same type
| 5. Generate new OTP
| 6. Save to DB
| 7. Send via email
| 8. Return success message
|--------------------------------------------------------------------------
*/

interface Dependencies {
    userRepository: IUserRepository;
    otpRepository:  IOtpRepository;
    mailService:    MailService;
    tokenService:   TokenService;
}

export class ResendOtpUseCase {
    private readonly userRepository: IUserRepository;
    private readonly otpRepository:  IOtpRepository;
    private readonly mailService:    MailService;
    private readonly tokenService:   TokenService;

    constructor({
        userRepository,
        otpRepository,
        mailService,
        tokenService,
    }: Dependencies) {
        this.userRepository = userRepository;
        this.otpRepository  = otpRepository;
        this.mailService    = mailService;
        this.tokenService   = tokenService;
    }

    async execute(
        dto:  ResendOtpDtoType,
        type: OtpType = OtpType.email_verification,
    ): Promise<{ message: string }> {

        // ── 1. Find user by email ─────────────────────────────────────────
        const user = await this.userRepository.findByEmail(dto.email);

        // ── 2. Check user exists and is active ────────────────────────────
        // Generic message — don't reveal if email exists
        if (!user || !user.isActive) {
            return {
                message: "If an account exists with this email, a new code will be sent shortly.",
            };
        }

        // ── 3. Check not already verified ────────────────────────────────
        if (
            type === OtpType.email_verification &&
            user.isEmailVerified
        ) {
            throw new BadRequestError(
                "Email is already verified. Please login.",
            );
        }

        // ── 4. Delete existing OTPs of same type ──────────────────────────
        await this.otpRepository.deleteByUserId(user.id, type);

        // ── 5. Generate new OTP ───────────────────────────────────────────
        const otp       = this.tokenService.generateOtp();
        const expiresIn = type === OtpType.email_verification
            ? OtpExpiryMinutes.EMAIL_VERIFICATION
            : OtpExpiryMinutes.PASSWORD_RESET;

        const expiresAt = this.tokenService.getOtpExpiry(expiresIn);

        // ── 6. Save to DB ─────────────────────────────────────────────────
        await this.otpRepository.create({
            userId:    user.id,
            code:      otp,
            type,
            expiresAt,
        });

        // ── 7. Send via email ─────────────────────────────────────────────
        await this.mailService.sendOtp(user.email, {
            firstName: user.firstName ?? "User",
            otp,
            expiresIn: `${expiresIn} minutes`,
            type,
        });

        // ── 8. Return success ─────────────────────────────────────────────
        return {
            message: "A new verification code has been sent to your email.",
        };
    }
}