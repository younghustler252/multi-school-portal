import { Prisma, PrismaClient } from "../../../../generated/public";
import { IUserRepository } from "../../../auth/repositories/user.repository";
import { IPlanRepository } from "../../../plans/repositories/plan.repository";
import { PasswordService } from "../../../../shared/services/password.service";
import { UrlService } from "../../../../shared/services/url.service";
import { AuthMessageService } from "../../../auth/services/auth-message.service";
import { legacyUserRole } from "../../../auth/services/legacy-role";
import { RESERVED_SUBDOMAINS } from "../../../auth/domain/auth.enums";
import { AuditService } from "../../../audit/services/audit.service";
import { addProvisionSchemaJob } from "../../../../infrastructure/jobs/queues/provision-schema.queue";
import { SchoolMapper, PlatformSchoolResponseData } from "../../mappers/school.mapper";
import { schoolErrors } from "../../domain/school.errors";
import { CreateSchoolDtoType } from "../../dtos/school.dto";
import { env } from "../../../../config/env";

interface Dependencies {
    prismaClient: PrismaClient; userRepository: IUserRepository; planRepository: IPlanRepository;
    passwordService: PasswordService; urlService: UrlService; authMessageService: AuthMessageService;
    auditService: AuditService; schoolMapper: SchoolMapper;
}

/*
| CREATE SCHOOL (platform staff; permission platform.schools.create)
| For sales-led or assisted onboarding. The school is already verified (a person at the platform vouched for it),
| gets the free plan, and is built right away. Its administrator is a NEW account with a temporary password
| (emailed, must be changed at first sign-in) or, if that email already has an account, the existing account is
| linked and nothing about its password changes. The administrator's real access is created by the provisioning
| worker (MembershipService.provisionFirstAdmin).
*/
export class CreatePlatformSchoolUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: CreateSchoolDtoType, actorUserId: string): Promise<PlatformSchoolResponseData> {
        const d = this.d;
        if (RESERVED_SUBDOMAINS.includes(dto.subdomain) || dto.subdomain === env.ADMIN_SUBDOMAIN.toLowerCase()) throw schoolErrors.subdomainReserved();

        const [bySub, byEmail, existingUser, freePlan] = await Promise.all([
            d.prismaClient.school.findFirst({ where: { subdomain: dto.subdomain }, select: { id: true } }),
            d.prismaClient.school.findFirst({ where: { email: dto.email, deletedAt: null }, select: { id: true } }),
            d.userRepository.findByEmail(dto.admin.email),
            d.planRepository.findFreePlan(),
        ]);
        if (bySub)   throw schoolErrors.subdomainTaken();
        if (byEmail) throw schoolErrors.emailTaken();
        if (!freePlan) throw schoolErrors.noFreePlan();

        const tempPassword = existingUser ? null : d.passwordService.generateTemp(12);
        const passwordHash = tempPassword ? await d.passwordService.hash(tempPassword) : null;
        const now = new Date();
        const end = new Date(now); end.setMonth(end.getMonth() + 1);

        const created = await d.prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
            const school = await tx.school.create({
                data: {
                    name: dto.name, subdomain: dto.subdomain, schemaName: `school_${dto.subdomain}`, email: dto.email, phone: dto.phone,
                    schoolCategory: dto.schoolCategory, schoolOwnership: dto.schoolOwnership,
                    status: "active", isActive: true, activatedAt: now,
                    verificationStatus: "verified", verifiedAt: now, verifiedById: actorUserId,
                },
            });
            await tx.subscription.create({
                data: { schoolId: school.id, planId: freePlan.id, status: "active", billingCycle: "monthly", currentPeriodStart: now, currentPeriodEnd: end },
            });
            const userId = existingUser?.id ?? (await tx.user.create({
                data: {
                    email: dto.admin.email, passwordHash: passwordHash!, firstName: dto.admin.firstName, lastName: dto.admin.lastName,
                    phone: dto.admin.phone, isActive: true, isEmailVerified: true, emailVerifiedAt: now, mustChangePassword: true,
                    role: legacyUserRole("STAFF", "school_admin"), schoolId: school.id,   // transitional legacy columns
                },
            })).id;
            await tx.userSchool.create({ data: { userId, schoolId: school.id } });
            return school;
        });

        await addProvisionSchemaJob({ schoolId: created.id, subdomain: created.subdomain, schoolName: created.name });

        const loginUrl = d.urlService.schoolUrl(created);
        await d.authMessageService.sendEmail(
            tempPassword ? "auth.account_created_by_platform" : "auth.welcome", dto.admin.email,
            { "recipient.firstName": dto.admin.firstName, "school.name": created.name, "school.url": loginUrl,
              ...(tempPassword ? { "temp.password": tempPassword } : {}) },
        );

        await d.auditService.log({
            userId: actorUserId, schoolId: created.id, action: "school.created_by_platform", entity: "School", entityId: created.id,
            newValue: { name: created.name, subdomain: created.subdomain, adminEmail: dto.admin.email, newAccount: !existingUser },
        });

        const row = await d.prismaClient.school.findUniqueOrThrow({ where: { id: created.id } });
        return d.schoolMapper.toPlatformResponse(d.schoolMapper.toDomain(row), { id: freePlan.id, name: freePlan.name }, 0);
    }
}
