import { IUserRepository }        from "../../auth/repositories/user.repository";
import { UserProfileMapper }      from "../mappers/user.mapper";
import { UserProfileResponseData } from "../mappers/user.mapper";
import { NotFoundError }          from "../../../shared/errors/domain.errors";
import { UpdateProfileDtoType }   from "../dtos/user.dto";

interface Dependencies {
    userRepository:    IUserRepository;
    userProfileMapper: UserProfileMapper;
}

export class UpdateProfileUseCase {
    private readonly userRepository:    IUserRepository;
    private readonly userProfileMapper: UserProfileMapper;

    constructor({ userRepository, userProfileMapper }: Dependencies) {
        this.userRepository    = userRepository;
        this.userProfileMapper = userProfileMapper;
    }

    async execute(
        userId: string,
        dto:    UpdateProfileDtoType,
    ): Promise<UserProfileResponseData> {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new NotFoundError("User");

        const updated = await this.userRepository.update(userId, dto);

        return this.userProfileMapper.toResponse({
            ...updated,
            passwordChangedAt: null,
        });
    }
}