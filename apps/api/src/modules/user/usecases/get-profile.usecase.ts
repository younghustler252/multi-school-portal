import { IUserRepository }    from "../../auth/repositories/user.repository";
import { UserProfileMapper, UserProfileResponseData } from "../mappers/user.mapper";
import { userErrors }         from "../domain/user.errors";
import { UserActionContext }  from "../domain/user.types";

interface Dependencies {
    userRepository:    IUserRepository;
    userProfileMapper: UserProfileMapper;
}

export class GetProfileUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(ctx: UserActionContext, persona: string | null): Promise<UserProfileResponseData> {
        const user = await this.d.userRepository.findById(ctx.userId);
        if (!user) throw userErrors.notFound();
        return this.d.userProfileMapper.toResponse(user, {
            schoolId: ctx.schoolId, persona, impersonating: !!ctx.impersonatedBy,
        });
    }
}
