import { Prisma, PrismaClient, OtpType } from "../../../generated/public/client";
import { IUserRepository }   from "../repositories/user.repository";
import { IPlanRepository }   from "../../plans/repositories/plan.repository";
import { PasswordService }   from "../../../shared/services/password.service";
import { OtpService }        from "../services/otp.service";
import { AuthMessageService } from "../services/auth-message.service";
import { AuthPolicyService } from "../services/auth-policy.service";
import { AuthAuditService }  from "../services/auth-audit.service";
import { legacyUserRole }    from "../services/legacy-role";
import { authErrors }        from "../domain/auth.errors";
import { RESERVED_SUBDOMAINS } from "../domain/auth.enums";
import { RegisterDtoType }   from "../dtos/register.dto";
import { RequestMeta }       from "../types/auth.types";
import { env }               from "../../../config/env";
import { redisConnection }   from "../../../infrastructure/jobs/connection";

const MAX_REGISTRATIONS_PER_IP_PER_DAY = 5;

interface Dependencies {
    prismaClient:       PrismaClient;
    userRepository:     IUserRepository;
    planRepository:     IPlanRepository;
    passwordService:    PasswordService;
    otpService:         OtpService;
    authMessageService: AuthMessageService;
    authPolicyService:  AuthPolicyService;
    authAuditService:   AuthAuditService;
}

// Adds calendar months without overflowing (Jan 31 + 1 month = Feb 28/29, not Mar 3)
export function addMonthsClamped(from: Date, months: number): Date {
    const d = new Date(from);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
}

/*
|--------------------------------------------------------------------------
| REGISTER (school self-registration)
| One database transaction creates the school, its free subscription, the admin
| user and the UserSchool link, so a failure leaves nothing behind. Registration
| REFUSES to proceed if no free plan exists (every school must have a
| subscription). Reserved subdomains are rejected.
|
| The admin's tenant Membership does not exist yet (the school schema is created
| by provisioning). Provisioning calls MembershipService.provisionFirstAdmin().
| The admin verifies email here (on the platform host) and first logs in on the
| school host once the school is active.
|--------------------------------------------------------------------------
*/

export class RegisterUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: RegisterDtoType, meta: RequestMeta): Promise<{ message: string; subdomain: string }> {
        const d = this.d;
        const subdomain = dto.subdomain;
        const email     = dto.email;

        if (RESERVED_SUBDOMAINS.includes(subdomain) || subdomain === env.ADMIN_SUBDOMAIN.toLowerCase()) {
            throw authErrors.subdomainReserved();
        }

        // Slows down people who register many throwaway schools to hold subdomains
        const regKey = `auth:register:${meta.ip}`;
        const regCount = await redisConnection.incr(regKey);
        if (regCount === 1) await redisConnection.expire(regKey, 86_400);
        if (regCount > MAX_REGISTRATIONS_PER_IP_PER_DAY) throw authErrors.registrationLimited();

        await d.authPolicyService.assertPasswordAllowed(dto.password, false);

        const [school, user] = await Promise.all([
            d.prismaClient.school.findFirst({
                where:  { OR: [{ subdomain }, { email: dto.schoolEmail }] },
                select: { subdomain: true },
            }),
            d.userRepository.findByEmail(email),
        ]);
        if (school) throw school.subdomain === subdomain ? authErrors.subdomainTaken() : authErrors.schoolEmailTaken();
        if (user)   throw authErrors.emailExists();

        const freePlan = await d.planRepository.findFreePlan();
        if (!freePlan) throw authErrors.registrationUnavailable();

        const passwordHash = await d.passwordService.hash(dto.password);
        const now          = new Date();

        const created = await d.prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
            const s = await tx.school.create({
                data: {
                    name:               dto.schoolName,
                    subdomain,
                    schemaName:         `school_${subdomain}`,
                    email:              dto.schoolEmail,
                    phone:              dto.schoolPhone,
                    city:               dto.city,
                    state:              dto.state,
                    schoolCategory:     dto.schoolCategory,
                    schoolOwnership:    dto.schoolOwnership,
                    status:             "pending",
                    verificationStatus: "unverified",
                    isActive:           false,
                },
            });

            await tx.subscription.create({
                data: {
                    schoolId:           s.id,
                    planId:             freePlan.id,
                    status:             "active",
                    billingCycle:       "monthly",
                    currentPeriodStart: now,
                    currentPeriodEnd:   addMonthsClamped(now, 1),
                },
            });

            const u = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    firstName:       dto.firstName,
                    lastName:        dto.lastName,
                    phone:           dto.phone,
                    isActive:        true,
                    isEmailVerified: false,
                    // transitional legacy columns (see legacy-role.ts)
                    role:            legacyUserRole("STAFF", "school_admin"),
                    schoolId:        s.id,
                },
            });

            await tx.userSchool.create({ data: { userId: u.id, schoolId: s.id } });
            return { schoolId: s.id, userId: u.id };
        });

        const code = await d.otpService.issue(created.userId, OtpType.email_verification);
        d.authMessageService.sendEmailSafely("auth.otp.email_verification", email, {
            "recipient.firstName": dto.firstName,
            "otp.code":            code,
            "otp.expiresIn":       `${d.otpService.expiryMinutes(OtpType.email_verification)} minutes`,
        });

        await d.authAuditService.record({
            action: "auth.school_registered", userId: created.userId, schoolId: created.schoolId,
            entity: "School", entityId: created.schoolId, ip: meta.ip, userAgent: meta.userAgent,
        });

        return {
            message:   "Registration successful. Check your email for your verification code.",
            subdomain,
        };
    }
}
