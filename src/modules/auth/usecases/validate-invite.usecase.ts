import { IInviteRepository }     from "../repositories/invite.repository";
import {
    BadRequestError,
    NotFoundError,
}                                from "../../../shared/errors/domain.errors";
import { AuthErrorMessage }      from "../domain/auth.enums";
import { ValidateInviteDtoType } from "../dtos/invite.dto";

/*
|--------------------------------------------------------------------------
| VALIDATE INVITE USE CASE
| Called before showing the accept invite form
| Returns invite details so frontend can pre-fill the form
|--------------------------------------------------------------------------
*/

interface Dependencies {
    inviteRepository: IInviteRepository;
}

export class ValidateInviteUseCase {
    private readonly inviteRepository: IInviteRepository;

    constructor({ inviteRepository }: Dependencies) {
        this.inviteRepository = inviteRepository;
    }

    async execute(dto: ValidateInviteDtoType): Promise<{
        email:      string;
        role:       string;
        schoolId:   string;
        expiresAt:  Date;
    }> {
        // ── Find invite ───────────────────────────────────────────────────
        const invite = await this.inviteRepository.findByToken(dto.token);

        if (!invite) {
            throw new NotFoundError(AuthErrorMessage.INVITE_NOT_FOUND);
        }

        // ── Check not already accepted ────────────────────────────────────
        if (invite.accepted) {
            throw new BadRequestError(AuthErrorMessage.INVITE_ALREADY_USED);
        }

        // ── Check not expired ─────────────────────────────────────────────
        if (invite.expiresAt < new Date()) {
            throw new BadRequestError(
                "This invite has expired. Please ask your school admin to send a new one.",
            );
        }

        return {
            email:     invite.email,
            role:      invite.role,
            schoolId:  invite.schoolId,
            expiresAt: invite.expiresAt,
        };
    }
}