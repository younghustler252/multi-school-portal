import { IUserRepository }    from "../../auth/repositories/user.repository";
import { UserProfileMapper, UserProfileResponseData } from "../mappers/user.mapper";
import { userErrors }         from "../domain/user.errors";
import { UserActionContext }  from "../domain/user.types";

interface Dependencies {
    userRepository:    IUserRepository;
    userProfileMapper: UserProfileMapper;
}

// Clears the photo reference. (The stored file is left in the bucket: the storage service exposes no delete yet.)
export class RemoveAvatarUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(ctx: UserActionContext, persona: string | null): Promise<UserProfileResponseData> {
        const user = await this.d.userRepository.findById(ctx.userId);
        if (!user) throw userErrors.notFound();
        const updated = user.photoUrl ? await this.d.userRepository.update(ctx.userId, { photoUrl: null }) : user;
        return this.d.userProfileMapper.toResponse(updated, { schoolId: ctx.schoolId, persona, impersonating: !!ctx.impersonatedBy });
    }
}
