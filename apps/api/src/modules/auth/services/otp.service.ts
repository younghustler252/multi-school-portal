import { OtpType } from "../../../generated/public/client";
import { TokenService } from "../../../shared/services/token.service";
import { IOtpRepository } from "../repositories/otp.repository";
import { TokenHashService } from "./token-hash.service";
import { OtpExpiryMinutes, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS } from "../domain/auth.enums";
import { authErrors } from "../domain/auth.errors";

const expiryFor = (type: OtpType): number => {
    switch (type) {
        case OtpType.email_verification: return OtpExpiryMinutes.EMAIL_VERIFICATION;
        case OtpType.password_reset:     return OtpExpiryMinutes.PASSWORD_RESET;
        default:                         return OtpExpiryMinutes.TWO_FACTOR;
    }
};

/*
|--------------------------------------------------------------------------
| OTP SERVICE
| One implementation of issue / cooldown / verify for every OTP flow.
| Codes are stored as HMACs; attempts are counted atomically BEFORE comparing,
| so parallel guesses cannot exceed the limit; a code can be used only once.
|--------------------------------------------------------------------------
*/

export class OtpService {
    private readonly otps:   IOtpRepository;
    private readonly tokens: TokenService;
    private readonly hasher: TokenHashService;

    constructor({ otpRepository, tokenService, tokenHashService }: {
        otpRepository: IOtpRepository; tokenService: TokenService; tokenHashService: TokenHashService;
    }) {
        this.otps = otpRepository; this.tokens = tokenService; this.hasher = tokenHashService;
    }

    expiryMinutes(type: OtpType): number {
        return expiryFor(type);
    }

    /** False while the previous code is younger than the resend cooldown. */
    async canIssue(userId: string, type: OtpType): Promise<boolean> {
        const latest = await this.otps.findLatest(userId, type);
        if (!latest) return true;
        return Date.now() - latest.createdAt.getTime() >= OTP_RESEND_COOLDOWN_SECONDS * 1000;
    }

    /** Replaces any earlier code of this type and returns the plain code (to be emailed, never stored). */
    async issue(userId: string, type: OtpType): Promise<string> {
        await this.otps.deleteByUserId(userId, type);
        const code = this.tokens.generateOtp();
        await this.otps.create({
            userId, type,
            code:      this.hasher.hashOtp(userId, type, code),
            expiresAt: this.tokens.getOtpExpiry(expiryFor(type)),
        });
        return code;
    }

    /** Throws unless `code` is the current valid code. Consumes it on success. */
    async verify(userId: string, type: OtpType, code: string): Promise<void> {
        const otp = await this.otps.findValid(userId, type);
        if (!otp) throw authErrors.invalidOtp();

        const attempts = await this.otps.registerAttempt(otp.id);
        if (attempts > OTP_MAX_ATTEMPTS) throw authErrors.otpMaxAttempts();

        if (!this.hasher.safeEqual(otp.code, this.hasher.hashOtp(userId, type, code))) {
            throw authErrors.invalidOtp();
        }
        if (!(await this.otps.consume(otp.id))) throw authErrors.invalidOtp();
    }
}
