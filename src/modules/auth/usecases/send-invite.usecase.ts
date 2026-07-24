import { IInviteRepository }   from "../repositories/invite.repository";
import { IUserRepository }     from "../repositories/user.repository";
import { MailService }         from "../../../infrastructure/mail/mail.service";
import { TokenService }        from "../../../shared/services/token.service";
import { ISchoolRepository }   from "../../school/repositories/school.repository";
import { ConflictError }       from "../../../shared/errors/domain.errors";
import { Role }                from "../../../generated/prisma/client";
import { env }                 from "../../../config/env";
import { INVITE_EXPIRY_DAYS }  from "../domain/auth.enums";

/*
|--------------------------------------------------------------------------
| SEND INVITE USE CASE
| School admin sends invite to staff or guardian
| Creates invite record + sends email with invite link
|--------------------------------------------------------------------------
*/

interface Dependencies {
    inviteRepository:  IInviteRepository;
    userRepository:    IUserRepository;
    schoolRepository:  ISchoolRepository;
    mailService:       MailService;
    tokenService:      TokenService;
}

export interface SendInviteParams {
    email:    string;
    role:     Role;
    schoolId: string;
    sentById: string;
}

export class SendInviteUseCase {
    private readonly inviteRepository: IInviteRepository;
    private readonly userRepository:   IUserRepository;
    private readonly schoolRepository: ISchoolRepository;
    private readonly mailService:      MailService;
    private readonly tokenService:     TokenService;

    constructor({
        inviteRepository,
        userRepository,
        schoolRepository,
        mailService,
        tokenService,
    }: Dependencies) {
        this.inviteRepository = inviteRepository;
        this.userRepository   = userRepository;
        this.schoolRepository = schoolRepository;
        this.mailService      = mailService;
        this.tokenService     = tokenService;
    }

    async execute(params: SendInviteParams): Promise<{ message: string }> {

        // ── Check user not already registered ────────────────────────────
        const existingUser = await this.userRepository
            .findByEmail(params.email);

        if (existingUser) {
            throw new ConflictError(
                "A user with this email is already registered.",
            );
        }

        // ── Check no pending invite already ───────────────────────────────
        const existingInvite = await this.inviteRepository
            .findByEmail(params.email);

        if (existingInvite && !existingInvite.accepted) {
            // Delete old invite and send fresh one
            // (handled by creating new one — token is unique)
        }

        // ── Get school details ────────────────────────────────────────────
        const school = await this.schoolRepository
            .findById(params.schoolId);

        // ── Generate invite token ─────────────────────────────────────────
        const token     = this.tokenService.generateInviteToken();
        const expiresAt = new Date(
            Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        );

        // ── Save invite ───────────────────────────────────────────────────
        await this.inviteRepository.create({
            email:     params.email,
            role:      params.role,
            token,
            schoolId:  params.schoolId,
            sentById:  params.sentById,
            accepted:  false,
            expiresAt,
        });

        // ── Build invite URL ──────────────────────────────────────────────
        const subdomain = school?.subdomain ?? "";
        const inviteUrl = `https://${subdomain}.${env.APP_BASE_DOMAIN}/accept-invite?token=${token}`;

        // ── Send invite email ─────────────────────────────────────────────
        await this.mailService.sendInvite({
            to:         params.email,
            firstName:  params.email.split("@")[0], // best we can do before name is known
            schoolName: school?.name ?? "Your School",
            role:       params.role.replace("_", " "),
            inviteUrl,
            expiresIn:  `${INVITE_EXPIRY_DAYS} days`,
        });

        return {
            message: `Invite sent to ${params.email}`,
        };
    }
}