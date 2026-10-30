import { OtpType }          from "../../../generated/public/client";
import { IUserRepository }  from "../repositories/user.repository";
import { OtpService }       from "../services/otp.service";
import { AuthMessageService } from "../services/auth-message.service";
import { AuthMessage }      from "../domain/auth.enums";
import { ResendOtpDtoType } from "../dtos/otp.dto";

interface Dependencies {
    userRepository:     IUserRepository;
    otpService:         OtpService;
    authMessageService: AuthMessageService;
}

/*
|--------------------------------------------------------------------------
| RESEND OTP
| Same generic answer whether or not anything was sent. A 60-second cooldown
| per account and type prevents email flooding.
|--------------------------------------------------------------------------
*/
export class ResendOtpUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: ResendOtpDtoType): Promise<{ message: string }> {
        const d    = this.d;
        const type = dto.type === "password_reset" ? OtpType.password_reset : OtpType.email_verification;
        const user = await d.userRepository.findByEmail(dto.email);

        const eligible =
            !!user && user.isActive &&
            (type === OtpType.password_reset || !user.isEmailVerified);

        if (user && eligible && await d.otpService.canIssue(user.id, type)) {
            const code = await d.otpService.issue(user.id, type);
            d.authMessageService.sendEmailSafely(
                type === OtpType.password_reset ? "auth.otp.password_reset" : "auth.otp.email_verification",
                user.email,
                {
                    "recipient.firstName": user.firstName ?? undefined,
                    "otp.code":            code,
                    "otp.expiresIn":       `${d.otpService.expiryMinutes(type)} minutes`,
                },
            );
        }
        return { message: AuthMessage.RESEND_GENERIC };
    }
}
