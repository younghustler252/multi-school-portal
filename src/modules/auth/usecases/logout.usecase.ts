import { IRefreshTokenRepository } from "../repositories/refresh-token.repository";
import { TokenService }            from "../../../shared/services/token.service";
import { AuthErrorMessage }        from "../domain/auth.enums";
import { UnauthorizedError }       from "../../../shared/errors/domain.errors";

interface Dependencies {
    refreshTokenRepository: IRefreshTokenRepository;
    tokenService:           TokenService;
}

export class LogoutUseCase {
    private readonly refreshTokenRepository: IRefreshTokenRepository;
    private readonly tokenService:           TokenService;

    constructor({ refreshTokenRepository, tokenService }: Dependencies) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenService           = tokenService;
    }

    async execute(refreshToken: string | undefined): Promise<void> {

        // If no token provided (cookie already cleared) — just return
        if (!refreshToken) return;

        // Try to verify — if invalid just return, don't throw
        let payload;
        try {
            payload = this.tokenService.verifyRefreshToken(refreshToken);
        } catch {
            // Token invalid or expired — still fine, nothing to delete
            return;
        }

        // Delete from DB if it exists
        try {
            await this.refreshTokenRepository.deleteByToken(refreshToken);
        } catch {
            // Already deleted or doesn't exist — still fine
            return;
        }
    }
}
