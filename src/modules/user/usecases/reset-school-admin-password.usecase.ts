import { PrismaClient }            from "../../../generated/public/client";
import { TenantContext }           from "../../../infrastructure/database/prisma/tenant.context";
import { IUserRepository }         from "../../auth/repositories/user.repository";
import { IRefreshTokenRepository } from "../../../usernew/user-module-v1/modules/auth/repositories/refresh-token.repository";
import { PasswordService }         from "../../../shared/services/password.service";
import { MembershipService }       from "../../auth/services/membership.service";
import { AuthMessageService }      from "../../auth/services/auth-message.service";
import { AuthAuditService }        from "../../auth/services/auth-audit.service";
import { userErrors }              from "../domain/user.errors";
import { UserActionContext }       from "../domain/user.types";
import { ResetAdminPasswordDtoType } from "../dtos/user.dto";

interface Dependencies {
    prismaClient:           PrismaClient;
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    passwordService:        PasswordService;
    membershipService:      MembershipService;
    authMessageService:     AuthMessageService;
    authAuditService:       AuthAuditService;
}

/*
|--------------------------------------------------------------------------
| RESET SCHOOL ADMIN PASSWORD (platform support action)
| Route guard: platform.users.manage (platform realm). The school's administrators are
| found through the tenant Membership (users holding the School Admin role), by briefly
| entering that school's tenant context. The password becomes a temporary one that the
| user must change at next sign-in; every session of that user is revoked.
| The temporary password is emailed; the email text lives in the auth.password_reset_by_support template.
|--------------------------------------------------------------------------
*/
export class ResetSchoolAdminPasswordUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, dto: ResetAdminPasswordDtoType, actor: UserActionContext): Promise<{ message: string }> {
        const d = this.d;

        const school = await d.prismaClient.school.findFirst({
            where: { id: schoolId, deletedAt: null }, select: { id: true, name: true, schemaName: true },
        });
        if (!school?.schemaName) throw userErrors.schoolNotFound();

        const adminIds = await new Promise<string[]>((resolve, reject) =>
            TenantContext.run({ tenantSchema: school.schemaName!, schoolId: school.id }, () => {
                d.membershipService.listActiveUserIdsByRoleKey("school_admin").then(resolve, reject);
            }),
        );

        let targetId: string | undefined;
        if (dto.userId) targetId = adminIds.includes(dto.userId) ? dto.userId : undefined;
        else if (adminIds.length === 1) targetId = adminIds[0];
        else if (adminIds.length > 1) throw userErrors.adminAmbiguous();
        if (!targetId) throw userErrors.adminNotFound();

        const target = await d.userRepository.findById(targetId);
        if (!target) throw userErrors.adminNotFound();

        const tempPassword = d.passwordService.generateTemp(12);
        await d.userRepository.update(target.id, {
            passwordHash:       await d.passwordService.hash(tempPassword),
            passwordChangedAt:  new Date(),
            mustChangePassword: true,
            failedLoginCount:   0,
            lockedUntil:        null,
        });
        await d.refreshTokenRepository.revokeAllForUser(target.id);

        await d.authAuditService.record({
            action: "user.admin_password_reset", module: "user", actorType: "super_admin",
            userId: actor.userId, schoolId: school.id, actorMembershipId: actor.membershipId,
            entity: "User", entityId: target.id, ip: actor.ip, userAgent: actor.userAgent,
            metadata: { mustChangePassword: true },
        });

        await d.authMessageService.sendEmail("auth.password_reset_by_support", target.email, {
            "recipient.firstName": target.firstName ?? undefined,
            "school.name":         school.name,
            "temp.password":       tempPassword,
        });

        return { message: `Password reset. A temporary password was emailed to ${target.email}` };
    }
}
