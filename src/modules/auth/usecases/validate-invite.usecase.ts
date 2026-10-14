import { IUserRepository } from "../repositories/user.repository";
import { InviteService }   from "../services/invite.service";
import { ValidateInviteDtoType } from "../dtos/invite.dto";

interface Dependencies {
    userRepository: IUserRepository;
    inviteService:  InviteService;
}

/*
|--------------------------------------------------------------------------
| VALIDATE INVITE
| Called by the accept page before showing the form. `accountExists` tells the
| frontend which form to show: existing people only confirm their password;
| new people enter name and choose a password.
|--------------------------------------------------------------------------
*/
export class ValidateInviteUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: ValidateInviteDtoType, hostSchoolId: string) {
        const invite  = await this.d.inviteService.loadUsable(dto.token, hostSchoolId);
        const school  = await this.d.inviteService.getSchool(invite.schoolId);
        const account = await this.d.userRepository.findByEmail(invite.email);

        return {
            email:         invite.email,
            persona:       invite.persona,
            roleName:      await this.d.inviteService.roleLabel(invite),
            schoolName:    school.name,
            accountExists: !!account,
            expiresAt:     invite.expiresAt,
        };
    }
}
