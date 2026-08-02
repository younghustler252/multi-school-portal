import { randomUUID }              from "crypto";
import { IUserRepository }         from "../repositories/user.repository";
import { IOtpRepository }          from "../repositories/otp.repository";
import { ISchoolRepository }       from "../../school/repositories/school.repository";
import { ISubscriptionRepository } from "../../subscriptions/repository/subscription.repository";
import { IPlanRepository }         from "../../plans/repositories/plan.repository";
import { MailService }             from "../../../infrastructure/mail/mail.service";
import { PasswordService }         from "../../../shared/services/password.service";
import { TokenService }            from "../../../shared/services/token.service";
import { addProvisionSchemaJob }   from "../../../infrastructure/jobs/queues/provision-schema.queue";
import { OtpType, Role }           from "../../../generated/public";
import {
    OtpExpiryMinutes,
    AuthErrorMessage,
}                                  from "../domain/auth.enums";
import {
    ConflictError,
    BadRequestError,
}                                  from "../../../shared/errors/domain.errors";
import { RegisterDtoType }         from "../dtos/register.dto";
import { env }                     from "../../../config/env";

/*
|--------------------------------------------------------------------------
| REGISTER USE CASE
| School self-registration flow
| Flow:
| 1.  Validate password strength
| 2.  Check subdomain is not taken
| 3.  Check school email is not taken
| 4.  Check admin email is not taken
| 5.  Hash password
| 6.  Create school (status: pending, isActive: false)
| 7.  Create admin user linked to school
| 8.  Generate OTP
| 9.  Save OTP to DB
| 10. Send verification email
| 11. Queue schema provisioning job
| 12. Return success message
|--------------------------------------------------------------------------
*/

interface Dependencies {
    userRepository:   IUserRepository;
    otpRepository:    IOtpRepository;
    schoolRepository: ISchoolRepository;
    subscriptionRepository: ISubscriptionRepository;
    planRepository: IPlanRepository;
    mailService:      MailService;
    passwordService:  PasswordService;
    tokenService:     TokenService;
}

export class RegisterUseCase {
    private readonly userRepository:   IUserRepository;
    private readonly otpRepository:    IOtpRepository;
    private readonly schoolRepository: ISchoolRepository;
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly planRepository: IPlanRepository;
    private readonly mailService:      MailService;
    private readonly passwordService:  PasswordService;
    private readonly tokenService:     TokenService;

    constructor({
        userRepository,
        otpRepository,
        schoolRepository,
        subscriptionRepository,
        planRepository,
        mailService,
        passwordService,
        tokenService,
    }: Dependencies) {
        this.userRepository   = userRepository;
        this.otpRepository    = otpRepository;
        this.schoolRepository = schoolRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository = planRepository;
        this.mailService      = mailService;
        this.passwordService  = passwordService;
        this.tokenService     = tokenService;
    }

    async execute(dto: RegisterDtoType): Promise<{ message: string; subdomain: string }> {
        // ── 1. Validate password strength ─────────────────────────────────
        const passwordValidation = this.passwordService.validate(dto.password);
        if (!passwordValidation.valid) {
            throw new BadRequestError(
                passwordValidation.message ?? "Password is too weak",
            );
        }

        // ── 2. Check subdomain is not taken ───────────────────────────────
        const cleanSubdomain = dto.subdomain.toLowerCase().trim();
        const existingSubdomain = await this.schoolRepository
            .findBySubdomain(cleanSubdomain);

        if (existingSubdomain) {
            throw new ConflictError(
                "This subdomain is already taken. Please choose another.",
            );
        }

        // ── 3. Check school email is not taken ────────────────────────────
        const existingSchoolEmail = await this.schoolRepository
            .findByEmail(dto.schoolEmail);

        if (existingSchoolEmail) {
            throw new ConflictError(
                "A school with this email already exists.",
            );
        }

        // ── 4. Check admin email is not taken ─────────────────────────────
        const existingUser = await this.userRepository
            .findByEmail(dto.email);

        if (existingUser) {
            throw new ConflictError(AuthErrorMessage.EMAIL_ALREADY_EXISTS);
        }

        // ── 5. Hash password ──────────────────────────────────────────────
        const passwordHash = await this.passwordService.hash(dto.password);

        // ── 6. Create school ──────────────────────────────────────────────
        const schemaName = `school_${cleanSubdomain}`;

        const school = await this.schoolRepository.create({
            name:            dto.schoolName,
            subdomain:       cleanSubdomain,
            schemaName,
            email:           dto.schoolEmail,
            phone:           dto.schoolPhone,
            city:            dto.city,
            state:           dto.state,
            schoolCategory:  dto.schoolCategory,
            schoolOwnership: dto.schoolOwnership,
            status:          "pending",
            verificationStatus: "unverified",
            isActive:        false,
        });

        const freePlan = await this.planRepository.findFreePlan();

        if (freePlan) {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await this.subscriptionRepository.create({
                schoolId:           school.id,
                planId:             freePlan.id,
                status:             "active",
                billingCycle:       "monthly",
                currentPeriodStart: now,
                currentPeriodEnd:   periodEnd,
            });
        }

        // ── 7. Create admin user ──────────────────────────────────────────
        const user = await this.userRepository.create({
            schoolId:     school.id,
            email:        dto.email,
            passwordHash,
            role:         Role.school_admin,
            firstName:    dto.firstName,
            lastName:     dto.lastName,
            phone:        dto.phone,
            isActive:     true,
            isEmailVerified: false,
        });

        // ── 8. Generate OTP ───────────────────────────────────────────────
        const otp       = this.tokenService.generateOtp();
        const expiresAt = this.tokenService.getOtpExpiry(
            OtpExpiryMinutes.EMAIL_VERIFICATION,
        );

        // ── 9. Save OTP ───────────────────────────────────────────────────
        await this.otpRepository.create({
            userId:    user.id,
            code:      otp,
            type:      OtpType.email_verification,
            expiresAt,
        });

        // ── 10. Send verification email ───────────────────────────────────
        await this.mailService.sendOtp(dto.email, {
            firstName: dto.firstName,
            otp,
            expiresIn: `${OtpExpiryMinutes.EMAIL_VERIFICATION} minutes`,
            type:      "email_verification",
        });

        // ── 11. Queue schema provisioning ─────────────────────────────────
        await addProvisionSchemaJob({
            schoolId:   school.id,
            subdomain:  cleanSubdomain,
            schoolName: dto.schoolName,
        });

        // ── 12. Return success ────────────────────────────────────────────
        return {
            message: `Registration successful. Please check ${dto.email} for your verification code.`,
            subdomain: cleanSubdomain,
        };
    }
}