import { IGuardianRepository }   from "../repositories/guardian.repository";
import { IStudentRepository }    from "../../students/repositories/student.repository";
import { IUserRepository }       from "../../auth/repositories/user.repository";
import { GuardianMapper }         from "../mappers/guardian.mapper";
import { GuardianResponseData }  from "../mappers/guardian.mapper";
import { PasswordService }        from "../../../shared/services/password.service";
import { MailService }            from "../../../infrastructure/mail/mail.service";
import { AuditService }            from "../../audit/services/audit.service";
import {
    ConflictError,
    NotFoundError,
}                                 from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage }   from "../domain/guardian.enums";
import { StudentErrorMessage }    from "../../students/domain/student.enums";
import { CreateGuardianDtoType }  from "../dtos/guardian.dto";
import { Role }                   from "../../../generated/public";

/*
|--------------------------------------------------------------------------
| CREATE GUARDIAN USE CASE
| Flow:
| 1. Check student exists
| 2. If guardian with this email already exists — just link (don't
|    recreate their account, they may already have one)
| 3. Otherwise: create User (public schema, login-ready) + Guardian
|    (tenant schema, linked via userId) + audit account creation +
|    send welcome email
| 4. Link guardian to student
|--------------------------------------------------------------------------
*/

interface Dependencies {
    guardianRepository: IGuardianRepository;
    studentRepository:  IStudentRepository;
    userRepository:     IUserRepository;
    guardianMapper:     GuardianMapper;
    passwordService:    PasswordService;
    mailService:        MailService;
    auditService:       AuditService;
}

export class CreateGuardianUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly studentRepository:  IStudentRepository;
    private readonly userRepository:     IUserRepository;
    private readonly guardianMapper:     GuardianMapper;
    private readonly passwordService:    PasswordService;
    private readonly mailService:        MailService;
    private readonly auditService:       AuditService;

    constructor({
        guardianRepository,
        studentRepository,
        userRepository,
        guardianMapper,
        passwordService,
        mailService,
        auditService,
    }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.studentRepository  = studentRepository;
        this.userRepository     = userRepository;
        this.guardianMapper     = guardianMapper;
        this.passwordService    = passwordService;
        this.mailService        = mailService;
        this.auditService       = auditService;
    }

    async execute(
        dto:      CreateGuardianDtoType,
        schoolId: string,
        userId:   string,
    ): Promise<GuardianResponseData> {

        // ── 1. Check student exists ───────────────────────────────────────
        const student = await this.studentRepository.findById(dto.studentId);
        if (!student) {
            throw new NotFoundError(StudentErrorMessage.NOT_FOUND);
        }

        // ── 2. Check if guardian with email already exists ────────────────
        let guardian = await this.guardianRepository.findByEmail(dto.email);

        if (guardian) {
            const alreadyLinked = await this.guardianRepository.isLinked(
                guardian.id,
                dto.studentId,
            );

            if (alreadyLinked) {
                throw new ConflictError(GuardianErrorMessage.ALREADY_LINKED);
            }
        } else {
            // ── 3a. Check email not already a different kind of user ──────
            const existingUser = await this.userRepository.findByEmail(dto.email);
            if (existingUser) {
                throw new ConflictError(
                    "A user with this email already exists.",
                );
            }

            // ── 3b. Create login account ───────────────────────────────────
            const tempPassword = this.generateTempPassword();
            const passwordHash = await this.passwordService.hash(tempPassword);

            const user = await this.userRepository.create({
                schoolId,
                email:           dto.email,
                passwordHash,
                role:             Role.guardian,
                firstName:       dto.firstName,
                lastName:        dto.lastName,
                phone:           dto.phone,
                isActive:        true,
                isEmailVerified: true,
                mustChangePassword: true,
            });

            // ── 3c. Create guardian record, linked to the new account ─────
            guardian = await this.guardianRepository.create({
                userId:     user.id,
                firstName:  dto.firstName,
                lastName:   dto.lastName,
                email:      dto.email,
                phone:      dto.phone,
                occupation: dto.occupation,
                address:    dto.address,
            });

            // ── 3d. Audit guardian account creation ───────────────────────
            await this.auditService.log({
                userId,
                schoolId,
                action:   "guardian.created",
                entity:   "Guardian",
                entityId: guardian.id,
                newValue: {
                    guardianId: guardian.id,
                    userId:     user.id,
                    studentId:  dto.studentId,
                    email:      user.email,
                    firstName:  user.firstName,
                    lastName:   user.lastName,
                    phone:      user.phone,
                    occupation: guardian.occupation,
                    address:    guardian.address,
                    relation:   dto.relation,
                    isPrimary:  dto.isPrimary,
                },
            });

            // ── 3e. Send welcome email with credentials ────────────────────
            await this.mailService.sendLetter(dto.email, {
                subject:    "Welcome to the parent portal — Your login details",
                title:      "Your Account is Ready",
                greeting:   `Hi ${dto.firstName},`,
                paragraphs: [
                    `A parent/guardian account has been created for you on SchoolPortal.`,
                    `Your login credentials are:`,
                    `Email: <strong>${dto.email}</strong>`,
                    `Temporary Password: <strong>${tempPassword}</strong>`,
                    `Please change your password after your first login.`,
                ],
                footer: "If you did not expect this email, please contact the school.",
            });
        }

        // ── 4. Link guardian to student ───────────────────────────────────
        await this.guardianRepository.linkToStudent({
            guardianId: guardian.id,
            studentId:  dto.studentId,
            relation:   dto.relation,
            isPrimary:  dto.isPrimary,
        });

        return this.guardianMapper.toResponse(guardian);
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
