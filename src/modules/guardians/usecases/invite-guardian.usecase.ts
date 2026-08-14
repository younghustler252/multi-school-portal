import { IGuardianRepository }   from "../repositories/guardian.repository";
import { ISchoolRepository }     from "../../school/repositories/school.repository";
import { MailService }           from "../../../infrastructure/mail/mail.service";
import { TokenService }          from "../../../shared/services/token.service";
import { NotFoundError }         from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage }  from "../domain/guardian.enums";
import { InviteGuardianDtoType } from "../dtos/guardian.dto";
import { env }                   from "../../../config/env";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    schoolRepository:   ISchoolRepository;
    mailService:        MailService;
    tokenService:       TokenService;
}

export class InviteGuardianUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly schoolRepository:   ISchoolRepository;
    private readonly mailService:        MailService;
    private readonly tokenService:       TokenService;

    constructor({
        guardianRepository,
        schoolRepository,
        mailService,
        tokenService,
    }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.schoolRepository   = schoolRepository;
        this.mailService        = mailService;
        this.tokenService       = tokenService;
    }

    async execute(
        dto:      InviteGuardianDtoType,
        schoolId: string,
    ): Promise<{ message: string }> {

        const guardian = await this.guardianRepository.findById(dto.guardianId);
        if (!guardian) {
            throw new NotFoundError(GuardianErrorMessage.NOT_FOUND);
        }

        const school = await this.schoolRepository.findById(schoolId);
        if (!school) {
            throw new NotFoundError("School not found");
        }

        const token     = this.tokenService.generateInviteToken();
        const inviteUrl = `https://${school.subdomain}.${env.APP_BASE_DOMAIN}/invite/guardian?token=${token}`;

        await this.mailService.sendInvite({
            to:         guardian.email,
            firstName:  guardian.firstName,
            schoolName: school.name,
            role:       "Parent/Guardian",
            inviteUrl,
            expiresIn:  "7 days",
        });

        return {
            message: `Invitation sent to ${guardian.email}`,
        };
    }
}