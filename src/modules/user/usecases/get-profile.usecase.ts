import { IUserRepository }        from "../../auth/repositories/user.repository";
import { UserProfileMapper }      from "../mappers/user.mapper";
import { UserProfileResponseData } from "../mappers/user.mapper";
import { NotFoundError }          from "../../../shared/errors/domain.errors";

interface Dependencies {
    userRepository:    IUserRepository;
    userProfileMapper: UserProfileMapper;
}

export class GetProfileUseCase {
    private readonly userRepository:    IUserRepository;
    private readonly userProfileMapper: UserProfileMapper;

    constructor({ userRepository, userProfileMapper }: Dependencies) {
        this.userRepository    = userRepository;
        this.userProfileMapper = userProfileMapper;
    }

    async execute(userId: string): Promise<UserProfileResponseData> {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new NotFoundError("User");

        return this.userProfileMapper.toResponse({
            ...user,
            passwordChangedAt: null,
        });
    }
}