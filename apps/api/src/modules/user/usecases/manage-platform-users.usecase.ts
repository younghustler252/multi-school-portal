import { IUserRepository }         from "../../auth/repositories/user.repository";
import { IRefreshTokenRepository } from "../../auth/repositories/refresh-token.repository";
import { AuthAuditService }        from "../../auth/services/auth-audit.service";
import { userErrors }              from "../domain/user.errors";
import { UserActionContext }       from "../domain/user.types";
import { DeactivateUserDtoType }   from "../dtos/user.dto";

interface Dependencies {
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    authAuditService:       AuthAuditService;
}

const summarise = (u: { id: string; email: string; firstName: string | null; lastName: string | null; isActive: boolean; lastLoginAt: Date | null }) => ({
    id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, isActive: u.isActive, lastLoginAt: u.lastLoginAt,
});

/*
|--------------------------------------------------------------------------
| PLATFORM-WIDE USER DEACTIVATION (platform support action)
| Route guard: platform.users.manage (platform realm). Flips the public User.isActive flag, which every
| auth flow already checks (login, refresh, switch-persona, impersonation exchange, forgot/reset password,
| invite acceptance, resend-otp) — so deactivating here locks the account out of EVERY school at once,
| without touching any school's own tenant Membership/Staff/Student status. The two are independent on
| purpose: a school can still suspend its own staff/students locally (modules/staff, modules/students)
| without this ever being involved.
| Deactivation also revokes every refresh-token session immediately (not just future logins).
| A platform user can never act on their own account through this route.
|--------------------------------------------------------------------------
*/
export class ManagePlatformUsersUseCase {
    constructor(private readonly d: Dependencies) {}

    async find(id: string) {
        const user = await this.d.userRepository.findById(id);
        if (!user) throw userErrors.notFound();
        return summarise(user);
    }

    async deactivate(id: string, dto: DeactivateUserDtoType, actor: UserActionContext) {
        if (id === actor.userId) throw userErrors.cannotActOnSelf();
        const user = await this.d.userRepository.findById(id);
        if (!user) throw userErrors.notFound();
        if (!user.isActive) return summarise(user);

        const updated = await this.d.userRepository.update(id, { isActive: false });
        await this.d.refreshTokenRepository.revokeAllForUser(id);

        await this.d.authAuditService.record({
            action: "user.deactivated", module: "user", actorType: "super_admin",
            userId: actor.userId, schoolId: actor.schoolId, actorMembershipId: actor.membershipId,
            entity: "User", entityId: id, ip: actor.ip, userAgent: actor.userAgent,
            metadata: dto.reason ? { reason: dto.reason } : undefined,
        });

        return summarise(updated);
    }

    async reactivate(id: string, actor: UserActionContext) {
        if (id === actor.userId) throw userErrors.cannotActOnSelf();
        const user = await this.d.userRepository.findById(id);
        if (!user) throw userErrors.notFound();
        if (user.isActive) return summarise(user);

        const updated = await this.d.userRepository.update(id, {
            isActive: true, failedLoginCount: 0, lockedUntil: null,
        });

        await this.d.authAuditService.record({
            action: "user.reactivated", module: "user", actorType: "super_admin",
            userId: actor.userId, schoolId: actor.schoolId, actorMembershipId: actor.membershipId,
            entity: "User", entityId: id, ip: actor.ip, userAgent: actor.userAgent,
        });

        return summarise(updated);
    }
}
