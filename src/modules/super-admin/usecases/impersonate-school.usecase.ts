import { randomUUID } from "crypto";
import { ISchoolRepository } from "../../school/repositories/school.repository";
import { IUserRepository } from "../../auth/repositories/user.repository";
import { redisConnection } from "../../../infrastructure/jobs/connection";// ⚠️ confirm this is the right export path in your setup
import { NotFoundError } from "../../../shared/errors/domain.errors";
import { Role } from "../../../generated/public";
import { env } from "../../../config/env";

const IMPERSONATION_TICKET_TTL_SECONDS = 60;

interface Dependencies {
    schoolRepository: ISchoolRepository;
    userRepository:   IUserRepository;
}

export class ImpersonateSchoolUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly userRepository:   IUserRepository;

    constructor({ schoolRepository, userRepository }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.userRepository   = userRepository;
    }

    async execute(schoolId: string): Promise<{
        redirectUrl: string;
        school:      any;
        admin:       any;
    }> {
        const school = await this.schoolRepository.findById(schoolId);
        if (!school) throw new NotFoundError("School");

        const admin = await this.userRepository.findOne({
            schoolId,
            role: Role.school_admin,
        });
        if (!admin) throw new NotFoundError("School admin not found");

        const ticket = randomUUID();

        await redisConnection.set(
            `impersonation:${ticket}`,
            JSON.stringify({ userId: admin.id, schoolId }),
            "EX",
            IMPERSONATION_TICKET_TTL_SECONDS,
        );

        return {
            redirectUrl: `https://${school.subdomain}.${env.APP_BASE_DOMAIN}/impersonate-entry?ticket=${ticket}`,
            school,
            admin,
        };
    }
}