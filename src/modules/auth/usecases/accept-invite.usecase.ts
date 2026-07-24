import { IInviteRepository }     from "../repositories/invite.repository";
import { IUserRepository }       from "../repositories/user.repository";
import { IRefreshTokenRepository } from "../repositories/refresh-token.repository";
import { PasswordService }       from "../../../shared/services/password.service";
import { TokenService }          from "../../../shared/services/token.service";
import { MailService }           from "../../../infrastructure/mail/mail.service";
import { UserMapper }            from "../mappers/user.mapper";
import {
    BadRequestError,
    NotFoundError,
    ConflictError,
}                                from "../../../shared/errors/domain.errors";
import { AuthErrorMessage }      from "../domain/auth.enums";
import { AcceptInviteDtoType }   from "../dtos/invite.dto";
import { AuthResponse }          from "../types/auth.types";
import { Role }                  from "../../../generated/prisma/client";
import { randomUUID }            from "crypto";

/*
|--------------------------------------------------------------------------
| ACCEPT INVITE USE CASE
| Staff/guardian clicks invite link and creates their account
| Flow:
| 1. Find + validate invite token
| 2. Check email not already a user
| 3. Hash password
| 4. Create User account
| 5. Mark invite as accepted
| 6. Generate token pair (auto-login after accept)
| 7. Send welcome email
| 8. Return tokens + user
|--------------------------------------------------------------------------
*/

interface Dependencies {
    inviteRepository:       IInviteRepository;
    userRepository:         IUserRepository;
    refreshTokenRepository: IRefreshTokenRepository;
    passwordService:        PasswordService;
    tokenService:           TokenService;
    mailService:            MailService;
    userMapper:             UserMapper;
}

export class AcceptInviteUseCase {
    private readonly inviteRepository:       IInviteRepository;
    private readonly userRepository:         IUserRepository;
    private readonly refreshTokenRepository: IRefreshTokenRepository;
    private readonly passwordService:        PasswordService;
    private readonly tokenService:           TokenService;
    private readonly mailService:            MailService;
    private readonly userMapper:             UserMapper;

    constructor({
        inviteRepository,
        userRepository,
        refreshTokenRepository,
        passwordService,
        tokenService,
        mailService,
        userMapper,
    }: Dependencies) {
        this.inviteRepository       = inviteRepository;
        this.userRepository         = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordService        = passwordService;
        this.tokenService           = tokenService;
        this.mailService            = mailService;
        this.userMapper             = userMapper;
    }

    async execute(dto: AcceptInviteDtoType): Promise<AuthResponse> {

        // ── 1. Find + validate invite ─────────────────────────────────────
        const invite = await this.inviteRepository.findByToken(dto.token);

        if (!invite) {
            throw new NotFoundError(AuthErrorMessage.INVITE_NOT_FOUND);
        }

        if (invite.accepted) {
            throw new BadRequestError(AuthErrorMessage.INVITE_ALREADY_USED);
        }

        if (invite.expiresAt < new Date()) {
            throw new BadRequestError(
                "This invite has expired. Please ask your admin to resend.",
            );
        }

        // ── 2. Check email not already a user ─────────────────────────────
        const existingUser = await this.userRepository
            .findByEmail(invite.email);

        if (existingUser) {
            // User exists — just mark invite accepted and return error
            // They should login instead
            throw new ConflictError(
                "An account with this email already exists. Please login instead.",
            );
        }

        // ── 3. Validate + hash password ───────────────────────────────────
        const passwordValidation = this.passwordService.validate(dto.password);
        if (!passwordValidation.valid) {
            throw new BadRequestError(
                passwordValidation.message ?? "Password is too weak",
            );
        }

        const passwordHash = await this.passwordService.hash(dto.password);

        // ── 4. Create user account ────────────────────────────────────────
        const user = await this.userRepository.create({
            schoolId:        invite.schoolId,
            email:           invite.email,
            passwordHash,
            role:            invite.role as Role,
            firstName:       dto.firstName,
            lastName:        dto.lastName,
            phone:           dto.phone,
            isActive:        true,
            isEmailVerified: true, // invite = email already verified
        });

        // ── 5. Mark invite as accepted ────────────────────────────────────
        await this.inviteRepository.markAccepted(invite.id);

        // ── 6. Generate token pair (auto-login) ───────────────────────────
        const tokenId = randomUUID();
        const tokens  = this.tokenService.generateTokenPair(
            {
                id:       user.id,
                email:    user.email,
                role:     user.role,
                schoolId: user.schoolId,
            },
            tokenId,
        );

        await this.refreshTokenRepository.create({
            id:        tokenId,
            userId:    user.id,
            token:     tokens.refreshToken,
            expiresAt: this.tokenService.getRefreshTokenExpiry(),
        });

        // ── 7. Send welcome email ─────────────────────────────────────────
        await this.mailService.sendLetter(user.email, {
            subject:    "Welcome — Your account is ready",
            title:      "Account Created Successfully 🎉",
            greeting:   `Hi ${dto.firstName},`,
            paragraphs: [
                "Your account has been set up successfully.",
                "You can now login and access your school portal.",
            ],
            footer: "If you did not create this account, please contact support immediately.",
        });

        // ── 8. Return tokens + user ───────────────────────────────────────
        return {
            tokens,
            user: this.userMapper.toResponse(user),
        };
    }
}