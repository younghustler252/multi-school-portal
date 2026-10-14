import { OtpType }          from "../../../generated/public/client";
import { IUserRepository }  from "../repositories/user.repository";
import { IRefreshTokenRepository } from "../repositories/refresh-token.repository";
import { PasswordService }  from "../../../shared/services/password.service";
import { OtpService }       from "../services/otp.service";
import { AuthPolicyService } from "../services/auth-policy.service";
import { AuthMessageService } from "../services/auth-message.service";
import { AuthAuditService } from "../services/auth-audit.service";
import { authErrors }       from "../domain/auth.errors";
import { AuthMessage }      from "../domain/auth.enums";
import { ResetPasswordDtoType } from "../dtos/password.dto";
import { RequestMeta }      from "../types/auth.types";

interface Dependencies {
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    passwordService:        PasswordService;
    otpService:             OtpService;
    authPolicyService:      AuthPolicyService;
    authMessageService:     AuthMessageService;
    authAuditService:       AuthAuditService;
}

/*
|--------------------------------------------------------------------------
| RESET PASSWORD
| - the new password is checked first (that reveals nothing and does not burn the code)
| - unknown account and wrong code are indistinguishable (INVALID_OTP)
| - a successful reset proves ownership of the inbox, so it also verifies the email,
|   clears lockout, and signs the user out of every device
| - note: access tokens already issued stay valid until they expire (<= access lifetime);
|   the authenticate middleware should reject tokens issued before passwordChangedAt
|--------------------------------------------------------------------------
*/
export class ResetPasswordUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: ResetPasswordDtoType, meta: RequestMeta, inTenant: boolean): Promise<{ message: string }> {
        const d = this.d;

        await d.authPolicyService.assertPasswordAllowed(dto.newPassword, inTenant);

        const user = await d.userRepository.findByEmail(dto.email);
        if (!user || !user.isActive) throw authErrors.invalidOtp();

        await d.otpService.verify(user.id, OtpType.password_reset, dto.otp);

        const now = new Date();
        await d.userRepository.update(user.id, {
            passwordHash:       await d.passwordService.hash(dto.newPassword),
            passwordChangedAt:  now,
            failedLoginCount:   0,
            lockedUntil:        null,
            mustChangePassword: false,
            ...(user.isEmailVerified ? {} : { isEmailVerified: true, emailVerifiedAt: now }),
        });

        await d.refreshTokenRepository.revokeAllForUser(user.id);

        await d.authAuditService.record({
            action: "auth.password_reset", userId: user.id, ip: meta.ip, userAgent: meta.userAgent,
        });
        d.authMessageService.sendEmailSafely("auth.password_changed", user.email, {
            "recipient.firstName": user.firstName ?? undefined,
        });

        return { message: AuthMessage.PASSWORD_RESET };
    }
}
