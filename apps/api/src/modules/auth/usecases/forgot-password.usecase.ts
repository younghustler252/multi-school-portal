import { OtpType }          from "../../../generated/public/client";
import { IUserRepository }  from "../repositories/user.repository";
import { OtpService }       from "../services/otp.service";
import { AuthMessageService } from "../services/auth-message.service";
import { AuthMessage }      from "../domain/auth.enums";
import { ForgotPasswordDtoType } from "../dtos/password.dto";

interface Dependencies {
    userRepository:     IUserRepository;
    otpService:         OtpService;
    authMessageService: AuthMessageService;
}

/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD
| Always the same response. The email is sent without awaiting delivery so
| response time does not depend on whether the account exists.
|--------------------------------------------------------------------------
*/
export class ForgotPasswordUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: ForgotPasswordDtoType): Promise<{ message: string }> {
        const d    = this.d;
        const user = await d.userRepository.findByEmail(dto.email);

        if (user && user.isActive && await d.otpService.canIssue(user.id, OtpType.password_reset)) {
            const code = await d.otpService.issue(user.id, OtpType.password_reset);
            d.authMessageService.sendEmailSafely("auth.otp.password_reset", user.email, {
                "recipient.firstName": user.firstName ?? undefined,
                "otp.code":            code,
                "otp.expiresIn":       `${d.otpService.expiryMinutes(OtpType.password_reset)} minutes`,
            });
        }
        return { message: AuthMessage.FORGOT_GENERIC };
    }
}
