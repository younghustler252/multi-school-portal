import { IGuardianRepository }          from "../repositories/guardian.repository";
import { ISchoolRepository }            from "../../school/repositories/school.repository";
import { MailService }                  from "../../../infrastructure/mail/mail.service";
import { TokenService }                 from "../../../shared/services/token.service";
import { NotFoundError }                from "../../../shared/errors/domain.errors";
import { BulkInviteGuardiansDtoType }   from "../dtos/guardian.dto";
import { env }                          from "../../../config/env";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    schoolRepository:   ISchoolRepository;
    mailService:        MailService;
    tokenService:       TokenService;
}

export type BulkInviteStatus = "sent" | "skipped" | "failed";

export interface BulkInviteResultItem {
    guardianId: string;
    status:     BulkInviteStatus;
    reason?:    string;
}

export interface BulkInviteGuardiansResult {
    sent:    number;
    skipped: number;
    failed:  number;
    results: BulkInviteResultItem[];
}

export class BulkInviteGuardiansUseCase {
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
        dto:      BulkInviteGuardiansDtoType,
        schoolId: string,
    ): Promise<BulkInviteGuardiansResult> {

        const school = await this.schoolRepository.findById(schoolId);
        if (!school) {
            throw new NotFoundError("School not found");
        }

        const results: BulkInviteResultItem[] = [];

        for (const guardianId of dto.guardianIds) {
            try {
                const guardian = await this.guardianRepository.findById(guardianId);

                if (!guardian) {
                    results.push({ guardianId, status: "failed", reason: "Guardian not found" });
                    continue;
                }

                if (guardian.userId) {
                    results.push({ guardianId, status: "skipped", reason: "Already has an account" });
                    continue;
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

                results.push({ guardianId, status: "sent" });
            } catch (err) {
                results.push({
                    guardianId,
                    status: "failed",
                    reason: err instanceof Error ? err.message : "Unknown error",
                });
            }
        }

        return {
            sent:    results.filter(r => r.status === "sent").length,
            skipped: results.filter(r => r.status === "skipped").length,
            failed:  results.filter(r => r.status === "failed").length,
            results,
        };
    }
}