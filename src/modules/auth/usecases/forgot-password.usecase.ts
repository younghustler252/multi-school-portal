import { IUserRepository }     from "../repositories/user.repository";
import { IOtpRepository }      from "../repositories/otp.repository";
import { MailService }         from "../../../infrastructure/mail/mail.service";
import { TokenService }        from "../../../shared/services/token.service";
import { OtpType }             from "../../../generated/prisma";
import {
    OtpExpiryMinutes,
}                              from "../domain/auth.enums";
import { ForgotPasswordDtoType } from "../dtos/password.dto";

/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD USE CASE
| Flow:
| 1. Find user by email
| 2. If user not found — return generic message (don't reveal if email exists)
| 3. Delete any existing password reset OTPs for this user
| 4. Generate new OTP
| 5. Save OTP to DB
| 6. Send OTP via email
| 7. Return generic success message
|--------------------------------------------------------------------------
*/

interface Dependencies {
    userRepository: IUserRepository;
    otpRepository:  IOtpRepository;
    mailService:    MailService;
    tokenService:   TokenService;
}

export class ForgotPasswordUseCase {
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
        dto: ForgotPasswordDtoType,
    ): Promise<{ message: string }> {

        // ── 1. Find user by email ─────────────────────────────────────────
        const user = await this.userRepository.findByEmail(dto.email);

        // ── 2. Generic response if user not found ─────────────────────────
        // Never reveal whether the email exists in the system
        if (!user || !user.isActive) {
            return {
                message: "If an account exists with this email, you will receive a reset code shortly.",
            };
        }

        // ── 3. Delete existing password reset OTPs ────────────────────────
        await this.otpRepository.deleteByUserId(
            user.id,
            OtpType.password_reset,
        );

        // ── 4. Generate OTP ───────────────────────────────────────────────
        const otp       = this.tokenService.generateOtp();
        const expiresAt = this.tokenService.getOtpExpiry(
            OtpExpiryMinutes.PASSWORD_RESET,
        );

        // ── 5. Save OTP to DB ─────────────────────────────────────────────
        await this.otpRepository.create({
            userId:    user.id,
            code:      otp,
            type:      OtpType.password_reset,
            expiresAt,
        });

        // ── 6. Send OTP via email ─────────────────────────────────────────
        await this.mailService.sendOtp(user.email, {
            firstName: user.firstName ?? "User",
            otp,
            expiresIn: `${OtpExpiryMinutes.PASSWORD_RESET} minutes`,
            type:      "password_reset",
        });

        // ── 7. Return generic message ─────────────────────────────────────
        return {
            message: "If an account exists with this email, you will receive a reset code shortly.",
        };
    }
}