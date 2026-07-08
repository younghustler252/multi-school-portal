import { IUserRepository }         from "../repositories/user.repository";
import { IRefreshTokenRepository } from "../repositories/refresh-token.repository";
import { TokenService }            from "../../../shared/services/token.service";
import { AuthErrorMessage }        from "../domain/auth.enums";
import { UnauthorizedError }       from "../../../shared/errors/domain.errors";
import { AuthResponse }            from "../types/auth.types";
import { UserMapper }              from "../mappers/user.mapper";

interface Dependencies {
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    tokenService:           TokenService;
    userMapper:             UserMapper;
}

export class RefreshTokenUseCase {
    private readonly userRepository:         IUserRepository;
    private readonly refreshTokenRepository: IRefreshTokenRepository;
    private readonly tokenService:           TokenService;
    private readonly userMapper:             UserMapper;

    constructor({
        userRepository,
        refreshTokenRepository,
        tokenService,
        userMapper,
    }: Dependencies) {
        this.userRepository         = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenService           = tokenService;
        this.userMapper             = userMapper;
    }

    async execute(refreshToken: string): Promise<AuthResponse> {
        // ── 1. Verify token signature and expiration ─────────────────────
        let payload;
        try {
            payload = this.tokenService.verifyRefreshToken(refreshToken);
        } catch (error) {
            throw new UnauthorizedError(AuthErrorMessage.INVALID_REFRESH_TOKEN);
        }

        // findByToken searches by token string — pass the actual token
        const storedToken = await this.refreshTokenRepository.findByToken(refreshToken);
        if (!storedToken || storedToken.expiresAt < new Date()) {
            throw new UnauthorizedError(AuthErrorMessage.INVALID_REFRESH_TOKEN);
        }

        // ── 3. Find the user attached to the token ───────────────────────
        const user = await this.userRepository.findById(payload.id);
        if (!user || !user.isActive) {
            throw new UnauthorizedError(AuthErrorMessage.INVALID_CREDENTIALS);
        }

        // delete using the token string
        await this.refreshTokenRepository.deleteByToken(refreshToken);

        // ── 5. Generate a brand new token pair ───────────────────────────
        const newTokenId = crypto.randomUUID();
        const tokens = this.tokenService.generateTokenPair(
            {
                id:       user.id,
                email:    user.email,
                role:     user.role,
                schoolId: user.schoolId,
            },
            newTokenId,
        );

        // ── 6. Save the new refresh token in DB ──────────────────────────
        await this.refreshTokenRepository.create({
            id:        newTokenId,
            userId:    user.id,
            token:     tokens.refreshToken,
            expiresAt: this.tokenService.getRefreshTokenExpiry(),
        });

        // ── 7. Return mapped user response and token pair ──────────────────
        return {
            user: this.userMapper.toResponse(user),
            tokens,
        };
    }
}
