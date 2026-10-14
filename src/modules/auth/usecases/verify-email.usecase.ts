import { OtpType }          from "../../../generated/public/client";
import { IUserRepository }  from "../repositories/user.repository";
import { OtpService }       from "../services/otp.service";
import { AuthAuditService } from "../services/auth-audit.service";
import { authErrors }       from "../domain/auth.errors";
import { AuthMessage }      from "../domain/auth.enums";
import { VerifyEmailDtoType } from "../dtos/otp.dto";
import { RequestMeta }      from "../types/auth.types";
import type { WorkspaceActivationService, WorkspaceInfo } from "../../school/services/workspace-activation.service";

interface Dependencies {
    userRepository:   IUserRepository;
    otpService:       OtpService;
    authAuditService: AuthAuditService;
    workspaceActivationService: WorkspaceActivationService;
}

/*
|--------------------------------------------------------------------------
| VERIFY EMAIL
| For someone who just registered a school, confirming the email also ACTIVATES the school: it is built
| right away and the response says where to sign in (workspace.state "setting_up" until the build finishes;
| the frontend polls GET /school/public/:subdomain until state is "active").
| Unknown email, already-verified account and wrong code all answer with the
| same INVALID_OTP, so this endpoint cannot be used to discover accounts.
|--------------------------------------------------------------------------
*/
export class VerifyEmailUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: VerifyEmailDtoType, meta: RequestMeta): Promise<{ message: string; workspace: WorkspaceInfo | null }> {
        const user = await this.d.userRepository.findByEmail(dto.email);
        if (!user || user.isEmailVerified) throw authErrors.invalidOtp();

        await this.d.otpService.verify(user.id, OtpType.email_verification, dto.otp);

        await this.d.userRepository.update(user.id, { isEmailVerified: true, emailVerifiedAt: new Date() });
        await this.d.authAuditService.record({
            action: "auth.email_verified", userId: user.id, ip: meta.ip, userAgent: meta.userAgent,
        });

        // The email is verified either way; a failure here must not undo it. A school left active but unbuilt
        // is picked up again by the daily lifecycle job.
        let workspace: WorkspaceInfo | null = null;
        try { workspace = await this.d.workspaceActivationService.activateForRegistrant(user.id); }
        catch (err) { console.error("[verify-email] workspace activation failed:", (err as Error).message); }

        return { message: AuthMessage.EMAIL_VERIFIED, workspace };
    }
}
