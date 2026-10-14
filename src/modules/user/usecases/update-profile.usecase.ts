import { IUserRepository }    from "../../auth/repositories/user.repository";
import { AuthAuditService }   from "../../auth/services/auth-audit.service";
import { UserProfileMapper, UserProfileResponseData } from "../mappers/user.mapper";
import { userErrors }         from "../domain/user.errors";
import { UserActionContext }  from "../domain/user.types";
import { UpdateProfileDtoType } from "../dtos/user.dto";

interface Dependencies {
    userRepository:    IUserRepository;
    userProfileMapper: UserProfileMapper;
    authAuditService:  AuthAuditService;
}

/*
| UPDATE PROFILE: name and phone only. Email, password and role are never changed here.
| The change is audited with before and after values of the fields that changed.
*/
export class UpdateProfileUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(ctx: UserActionContext, persona: string | null, dto: UpdateProfileDtoType): Promise<UserProfileResponseData> {
        const d    = this.d;
        const user = await d.userRepository.findById(ctx.userId);
        if (!user) throw userErrors.notFound();

        const before: Record<string, unknown> = {};
        const after:  Record<string, unknown> = {};
        for (const key of ["firstName", "lastName", "phone"] as const) {
            if (dto[key] !== undefined && dto[key] !== user[key]) {
                before[key] = user[key];
                after[key]  = dto[key];
            }
        }

        const updated = Object.keys(after).length ? await d.userRepository.update(ctx.userId, after) : user;

        if (Object.keys(after).length) {
            await d.authAuditService.record({
                action: "user.profile_updated", module: "user", userId: ctx.userId, schoolId: ctx.schoolId,
                actorMembershipId: ctx.membershipId, entity: "User", entityId: ctx.userId,
                oldValue: before, newValue: after, ip: ctx.ip, userAgent: ctx.userAgent,
                metadata: ctx.impersonatedBy ? { impersonatedBy: ctx.impersonatedBy } : undefined,
            });
        }
        return d.userProfileMapper.toResponse(updated, { schoolId: ctx.schoolId, persona, impersonating: !!ctx.impersonatedBy });
    }
}
