import { IUserRepository }       from "../../auth/repositories/user.repository";
import { IRefreshTokenRepository } from "../../auth/repositories/refresh-token.repository";
import { PasswordService }       from "../../../shared/services/password.service";
import {
    NotFoundError,
    BadRequestError,
}                                from "../../../shared/errors/domain.errors";
import { UserErrorMessage }      from "../domain/user.enums";
import { ChangePasswordDtoType } from "../dtos/user.dto";

/*
|--------------------------------------------------------------------------
| CHANGE PASSWORD USE CASE
| Logged-in user changes their own password
| Invalidates all refresh tokens — forces re-login on all devices
|--------------------------------------------------------------------------
*/

interface Dependencies {
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    passwordService:        PasswordService;
}

export class ChangePasswordUseCase {
    private readonly userRepository:         IUserRepository;
    private readonly refreshTokenRepository: IRefreshTokenRepository;
    private readonly passwordService:        PasswordService;

    constructor({
        userRepository,
        refreshTokenRepository,
        passwordService,
    }: Dependencies) {
        this.userRepository         = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordService        = passwordService;
    }

    async execute(
        userId: string,
        dto:    ChangePasswordDtoType,
    ): Promise<{ message: string }> {

        // ── Find user with password ───────────────────────────────────────
        const userWithPassword = await this.userRepository
            .findByEmailWithPassword(
                (await this.userRepository.findById(userId))!.email,
            );

        if (!userWithPassword) throw new NotFoundError("User");

        // ── Verify current password ───────────────────────────────────────
        const isValid = await this.passwordService.compare(
            dto.currentPassword,
            userWithPassword.passwordHash,
        );

        if (!isValid) {
            throw new BadRequestError(UserErrorMessage.WRONG_PASSWORD);
        }

        // ── Check new password is different ───────────────────────────────
        const isSame = await this.passwordService.compare(
            dto.newPassword,
            userWithPassword.passwordHash,
        );

        if (isSame) {
            throw new BadRequestError(UserErrorMessage.SAME_PASSWORD);
        }

        // ── Hash new password ─────────────────────────────────────────────
        const passwordHash = await this.passwordService.hash(dto.newPassword);

        // ── Update password ───────────────────────────────────────────────
       await this.userRepository.update(userId, {
            passwordHash,
            passwordChangedAt:  new Date(),
            mustChangePassword: false,
        });
        // ── Invalidate all sessions ───────────────────────────────────────
        await this.refreshTokenRepository.deleteByUserId(userId);

        return {
            message: "Password changed successfully. Please login again.",
        };
    }
}