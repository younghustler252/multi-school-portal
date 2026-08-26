import crypto from "crypto";
import { IUserRepository }         from "../repositories/user.repository";
import { IRefreshTokenRepository } from "../repositories/refresh-token.repository";
import { TokenService }            from "../../../shared/services/token.service";
import { UserMapper }              from "../mappers/user.mapper";
import { redisConnection }         from "../../../infrastructure/jobs/connection";
import { UnauthorizedError, ForbiddenError } from "../../../shared/errors/domain.errors";
import { AuthResponse }            from "../types/auth.types";

interface Dependencies {
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    tokenService:           TokenService;
    userMapper:             UserMapper;
}

export class ExchangeImpersonationTokenUseCase {
    private readonly userRepository:         IUserRepository;
    private readonly refreshTokenRepository: IRefreshTokenRepository;
    private readonly tokenService:           TokenService;
    private readonly userMapper:             UserMapper;

    constructor({ userRepository, refreshTokenRepository, tokenService, userMapper }: Dependencies) {
        this.userRepository         = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenService           = tokenService;
        this.userMapper             = userMapper;
    }

    async execute(ticket: string, requestSchoolId: string): Promise<AuthResponse> {
        const raw = await redisConnection.get(`impersonation:${ticket}`);
        if (!raw) {
            throw new UnauthorizedError("Invalid or expired impersonation link");
        }

        await redisConnection.del(`impersonation:${ticket}`); // consumed — one shot only

        const { userId, schoolId } = JSON.parse(raw);

        if (schoolId !== requestSchoolId) {
            throw new ForbiddenError("This link is not valid for this school.");
        }

        const user = await this.userRepository.findById(userId);
        if (!user || !user.isActive) {
            throw new UnauthorizedError("Account no longer valid.");
        }

        const tokenId = crypto.randomUUID();
        const tokens = this.tokenService.generateTokenPair(
            {
                id:                 user.id,
                email:              user.email,
                role:               user.role,
                schoolId:           user.schoolId,
                mustChangePassword: user.mustChangePassword,
            },
            tokenId,
        );

        await this.refreshTokenRepository.create({
            id:        tokenId,
            userId:    user.id,
            token:     tokens.refreshToken,
            expiresAt: this.tokenService.getRefreshTokenExpiry(),
        });

        return {
            user: this.userMapper.toResponse(user),
            tokens,
        };
    }
}