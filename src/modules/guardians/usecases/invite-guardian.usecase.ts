import { IGuardianRepository }  from "../repositories/guardian.repository";
import { MailService }          from "../../../infrastructure/mail/mail.service";
import { TokenService }         from "../../../shared/services/token.service";
import { NotFoundError }        from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage } from "../domain/guardian.enums";
import { InviteGuardianDtoType } from "../dtos/guardian.dto";
import { env }                  from "../../../config/env";

/*
|--------------------------------------------------------------------------
| INVITE GUARDIAN USE CASE
| Sends invite email to guardian so they can create a portal account
| Guardian can then view child's grades, report cards, fee invoices
|--------------------------------------------------------------------------
*/

interface Dependencies {
    guardianRepository: IGuardianRepository;
    mailService:        MailService;
    tokenService:       TokenService;
}

export class InviteGuardianUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly mailService:        MailService;
    private readonly tokenService:       TokenService;

    constructor({
        guardianRepository,
        mailService,
        tokenService,
    }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.mailService        = mailService;
        this.tokenService       = tokenService;
    }

    async execute(
        dto:        InviteGuardianDtoType,
        schoolName: string,
        subdomain:  string,
    ): Promise<{ message: string }> {

        // ── Find guardian ─────────────────────────────────────────────────
        const guardian = await this.guardianRepository.findById(
            dto.guardianId,
        );

        if (!guardian) {
            throw new NotFoundError(GuardianErrorMessage.NOT_FOUND);
        }

        // ── Generate invite token ─────────────────────────────────────────
        const token     = this.tokenService.generateInviteToken();
        const inviteUrl = `https://${subdomain}.${env.APP_BASE_DOMAIN}/invite/guardian?token=${token}`;

        // ── Send invite email ─────────────────────────────────────────────
        await this.mailService.sendInvite({
            to:         guardian.email,
            firstName:  guardian.firstName,
            schoolName,
            role:       "Parent/Guardian",
            inviteUrl,
            expiresIn:  "7 days",
        });

        return {
            message: `Invitation sent to ${guardian.email}`,
        };
    }
}