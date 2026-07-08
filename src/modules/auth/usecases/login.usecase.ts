// import randomuuid

import { IUserRepository }          from "../repositories/user.repository";
import { IRefreshTokenRepository }  from "../repositories/refresh-token.repository";
import { TokenService }             from "../../../shared/services/token.service";
import { PasswordService }          from "../../../shared/services/password.service";
import {
    AuthErrorMessage,
    MAX_FAILED_LOGIN_ATTEMPTS,
    LOCK_DURATION_MINUTES,
}                                   from "../domain/auth.enums";
import {
    UnauthorizedError,
    ForbiddenError,
}                                   from "../../../shared/errors/domain.errors";
import { LoginDtoType }             from "../dtos/login.dto";
import { AuthResponse }             from "../types/auth.types";
import { UserMapper }               from "../mappers/user.mapper";

/*
|--------------------------------------------------------------------------
| LOGIN USE CASE
| Flow:
| 1. Find user by email (with password hash)
| 2. Check account is active
| 3. Check account is not locked
| 4. Verify password
| 5. Check email is verified
| 6. Handle failed login — increment or lock account
| 7. Reset failed login count on success
| 8. Generate token pair
| 9. Store refresh token in DB
| 10. Update last login timestamp + IP
| 11. Return tokens + user
|--------------------------------------------------------------------------
*/

interface Dependencies {
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    tokenService:           TokenService;
    passwordService:        PasswordService;
    userMapper:             UserMapper;
}

export class LoginUseCase {
    private readonly userRepository:         IUserRepository;
    private readonly refreshTokenRepository: IRefreshTokenRepository;
    private readonly tokenService:           TokenService;
    private readonly passwordService:        PasswordService;
    private readonly userMapper:             UserMapper;

    constructor({
        userRepository,
        refreshTokenRepository,
        tokenService,
        passwordService,
        userMapper,
    }: Dependencies) {
        this.userRepository         = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenService           = tokenService;
        this.passwordService        = passwordService;
        this.userMapper             = userMapper;
    }

    async execute(
        dto: LoginDtoType,
        ip:  string,
    ): Promise<AuthResponse> {

        // ── 1. Find user with password ────────────────────────────────────
        const userWithPassword = await this.userRepository
            .findByEmailWithPassword(dto.email);

        if (!userWithPassword) {
           // Generic message — don't reveal if email exists
            throw new UnauthorizedError(AuthErrorMessage.INVALID_CREDENTIALS);
        }

        // ── 2. Check account is active ────────────────────────────────────
        if (!userWithPassword.isActive) {
            throw new ForbiddenError(AuthErrorMessage.ACCOUNT_INACTIVE);
        }

        // ── 3. Check account is not locked ────────────────────────────────
        if (
            userWithPassword.lockedUntil &&
            userWithPassword.lockedUntil > new Date()
        ) {
            throw new ForbiddenError(AuthErrorMessage.ACCOUNT_LOCKED);
        }

        // ── 4. Verify password ────────────────────────────────────────────
        const passwordValid = await this.passwordService.compare(
            dto.password,
            userWithPassword.passwordHash,
        );

        if (!passwordValid) {
            // Increment failed login count
            await this.userRepository.incrementFailedLogin(userWithPassword.id);

            // Lock account if max attempts reached
            const newFailedCount = userWithPassword.failedLoginCount + 1;

            if (newFailedCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
                const lockUntil = new Date(
                    Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
                );
                await this.userRepository.lockAccount(
                    userWithPassword.id,
                    lockUntil,
                );
                throw new ForbiddenError(AuthErrorMessage.ACCOUNT_LOCKED);
            }

            throw new UnauthorizedError(AuthErrorMessage.INVALID_CREDENTIALS);
        }

        // ── 5. Check email verified ───────────────────────────────────────
        if (!userWithPassword.isEmailVerified) {
            throw new ForbiddenError(AuthErrorMessage.EMAIL_NOT_VERIFIED);
        }

        // ── 6. Reset failed login count ───────────────────────────────────
        if (userWithPassword.failedLoginCount > 0) {
            await this.userRepository.resetFailedLogin(userWithPassword.id);
        }

        // ── 7. Generate token pair ────────────────────────────────────────
        const tokenId = crypto.randomUUID();

        const tokens = this.tokenService.generateTokenPair(
            {
                id:       userWithPassword.id,
                email:    userWithPassword.email,
                role:     userWithPassword.role,
                schoolId: userWithPassword.schoolId,
            },
            tokenId,
        );

        // ── 8. Store refresh token ────────────────────────────────────────
        await this.refreshTokenRepository.create({
            id:        tokenId,
            userId:    userWithPassword.id,
            token:     tokens.refreshToken,
            expiresAt: this.tokenService.getRefreshTokenExpiry(),
        });

        // ── 9. Update last login ──────────────────────────────────────────
        await this.userRepository.updateLastLogin(userWithPassword.id, ip);

        // ── 10. Return response ───────────────────────────────────────────
        return {
            user:   this.userMapper.toResponse(userWithPassword),
            tokens,
        };
    }
}