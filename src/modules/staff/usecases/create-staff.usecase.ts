import { IStaffRepository }    from "../repositories/staff.repository";
import { IUserRepository }     from "../../auth/repositories/user.repository";
import { StaffMapper }         from "../mappers/staff.mapper";
import { StaffResponseData }   from "../mappers/staff.mapper";
import { PasswordService }     from "../../../shared/services/password.service";
import { MailService }         from "../../../infrastructure/mail/mail.service";
import { TokenService }        from "../../../shared/services/token.service";
import {
    ConflictError,
    BadRequestError,
}                              from "../../../shared/errors/domain.errors";
import { StaffErrorMessage }   from "../domain/staff.enums";
import { CreateStaffDtoType }  from "../dtos/staff.dto";
import { Role }                from "../../../generated/prisma/enums";

/*
|--------------------------------------------------------------------------
| CREATE STAFF USE CASE
| School admin creates a staff member
| Flow:
| 1. Check employee ID not taken
| 2. Check email not already a user
| 3. Generate temporary password if not provided
| 4. Hash password
| 5. Create User record in public schema
| 6. Create Staff record in tenant schema
| 7. Send invite email with temporary password
|--------------------------------------------------------------------------
*/

interface Dependencies {
    staffRepository:   IStaffRepository;
    userRepository:    IUserRepository;
    staffMapper:       StaffMapper;
    passwordService:   PasswordService;
    mailService:       MailService;
    tokenService:      TokenService;
}

export class CreateStaffUseCase {
    private readonly staffRepository:  IStaffRepository;
    private readonly userRepository:   IUserRepository;
    private readonly staffMapper:      StaffMapper;
    private readonly passwordService:  PasswordService;
    private readonly mailService:      MailService;
    private readonly tokenService:     TokenService;

    constructor({
        staffRepository,
        userRepository,
        staffMapper,
        passwordService,
        mailService,
        tokenService,
    }: Dependencies) {
        this.staffRepository  = staffRepository;
        this.userRepository   = userRepository;
        this.staffMapper      = staffMapper;
        this.passwordService  = passwordService;
        this.mailService      = mailService;
        this.tokenService     = tokenService;
    }

    async execute(
        dto:      CreateStaffDtoType,
        schoolId: string,
    ): Promise<StaffResponseData> {

        // ── 1. Check employee ID not taken ────────────────────────────────
        if (dto.employeeId) {
            const existing = await this.staffRepository
                .findByEmployeeId(dto.employeeId);

            if (existing) {
                throw new ConflictError(StaffErrorMessage.EMPLOYEE_ID_TAKEN);
            }
        }

        // ── 2. Check email not already a user ─────────────────────────────
        const existingUser = await this.userRepository
            .findByEmail(dto.email);

        if (existingUser) {
            throw new ConflictError(
                "A user with this email already exists.",
            );
        }

        // ── 3. Generate temporary password if not provided ────────────────
        const tempPassword = dto.password ?? this.generateTempPassword();

        // ── 4. Hash password ──────────────────────────────────────────────
        const passwordHash = await this.passwordService.hash(tempPassword);

        // ── 5. Create User record in public schema ────────────────────────
        const user = await this.userRepository.create({
            schoolId,
            email:           dto.email,
            passwordHash,
            role:            dto.role as Role,
            firstName:       dto.firstName,
            lastName:        dto.lastName,
            phone:           dto.phone,
            isActive:        true,
            isEmailVerified: true, // staff don't need email verification
        });

        // ── 6. Create Staff record in tenant schema ───────────────────────
        const staff = await this.staffRepository.create({
            userId:        user.id,
            employeeId:    dto.employeeId,
            role:          dto.role,
            department:    dto.department,
            designation:   dto.designation,
            qualification: dto.qualification,
            gender:        dto.gender,
            dateOfBirth:   dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            address:       dto.address,
            joinDate:      dto.joinDate ? new Date(dto.joinDate) : null,
        });

        // ── 7. Send welcome email with credentials ────────────────────────
        await this.mailService.sendLetter(dto.email, {
            subject:    "Welcome to the team — Your login details",
            title:      "Your Account is Ready",
            greeting:   `Hi ${dto.firstName},`,
            paragraphs: [
                `Your staff account has been created on SchoolPortal.`,
                `Your login credentials are:`,
                `Email: <strong>${dto.email}</strong>`,
                `Temporary Password: <strong>${tempPassword}</strong>`,
                `Please change your password after your first login.`,
            ],
            footer: "If you did not expect this email, please contact your school administrator.",
        });

        // Enrich staff entity with user data for response
        const enriched = {
            ...staff,
            firstName: user.firstName,
            lastName:  user.lastName,
            email:     user.email,
            phone:     user.phone,
            photoUrl:  user.photoUrl,
        };

        return this.staffMapper.toResponse(enriched);
    }

    private generateTempPassword(): string {
        const chars  = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
        let password = "";
        for (let i = 0; i < 10; i++) {
            password += chars[Math.floor(Math.random() * chars.length)];
        }
        return password;
    }
}