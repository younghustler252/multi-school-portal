import { IUserRepository }         from "../../auth/repositories/user.repository";
import { IRefreshTokenRepository } from "../../auth/repositories/refresh-token.repository";
import { NotFoundError, BadRequestError } from "../../../shared/errors/domain.errors";
import { SuperAdminErrorMessage }  from "../domain/super-admin.enums";

interface Dependencies {
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
}

export class DeactivateUserUseCase {
    private readonly userRepository:         IUserRepository;
    private readonly refreshTokenRepository: IRefreshTokenRepository;

    constructor({ userRepository, refreshTokenRepository }: Dependencies) {
        this.userRepository         = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    async execute(
        userId:          string,
        requestingUserId: string,
    ): Promise<{ message: string }> {
        if (userId === requestingUserId) {
            throw new BadRequestError(SuperAdminErrorMessage.CANNOT_DELETE_SELF);
        }

        const user = await this.userRepository.findById(userId);
        if (!user) throw new NotFoundError(SuperAdminErrorMessage.USER_NOT_FOUND);

        await this.userRepository.update(userId, { isActive: false });
        await this.refreshTokenRepository.deleteByUserId(userId);

        return { message: "User deactivated successfully" };
    }
}