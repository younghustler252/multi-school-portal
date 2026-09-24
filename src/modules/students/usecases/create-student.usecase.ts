import { IStudentRepository } from "../repositories/student.repository";
import { StudentMapper } from "../mappers/student.mapper";
import { StudentResponseData } from "../mappers/student.mapper";
import { IUserRepository } from "../../auth/repositories/user.repository";
import { PasswordService } from "../../../shared/services/password.service";
import { MailService } from "../../../infrastructure/mail/mail.service";
import { ISchoolSettingsRepository } from "../../school-settings/repositories/school-settings.repository";
import { ConflictError } from "../../../shared/errors/domain.errors";
import { StudentErrorMessage } from "../domain/student.enums";
import { CreateStudentDtoType } from "../dtos/student.dto";
import { Role } from "../../../generated/public";

/*
|--------------------------------------------------------------------------
| CREATE STUDENT USE CASE
|
| Flow:
| 1. Check admission number is not already taken
| 2. Check student login requirements when enabled
| 3. Create User account when student login is enabled
| 4. Create Student record linked to User
| 5. Send welcome email when login account is created
|--------------------------------------------------------------------------
*/

interface Dependencies {
    studentRepository: IStudentRepository;
    studentMapper: StudentMapper;
    userRepository: IUserRepository;
    passwordService: PasswordService;
    mailService: MailService;
    schoolSettingsRepository: ISchoolSettingsRepository;
}

export class CreateStudentUseCase {
    private readonly studentRepository: IStudentRepository;
    private readonly studentMapper: StudentMapper;
    private readonly userRepository: IUserRepository;
    private readonly passwordService: PasswordService;
    private readonly mailService: MailService;
    private readonly schoolSettingsRepository: ISchoolSettingsRepository;

    constructor({
        studentRepository,
        studentMapper,
        userRepository,
        passwordService,
        mailService,
        schoolSettingsRepository,
    }: Dependencies) {
        this.studentRepository = studentRepository;
        this.studentMapper = studentMapper;
        this.userRepository = userRepository;
        this.passwordService = passwordService;
        this.mailService = mailService;
        this.schoolSettingsRepository = schoolSettingsRepository;
    }

    async execute(
        dto: CreateStudentDtoType,
        schoolId: string,
    ): Promise<StudentResponseData> {

        // ── 1. Check admission number is not taken ────────────────────────
        if (dto.admissionNumber) {
            const existing =
                await this.studentRepository.findByAdmissionNumber(
                    dto.admissionNumber,
                );

            if (existing) {
                throw new ConflictError(
                    StudentErrorMessage.ADMISSION_NUMBER_TAKEN,
                );
            }
        }

        // ── 2. Get school settings ────────────────────────────────────────
        const settings = await this.schoolSettingsRepository.find();
        const allowStudentLogin = settings?.allowStudentLogin ?? false;


        // ── 3. Student login requirements ─────────────────────────────────
        if (allowStudentLogin && !dto.email) {
            throw new ConflictError(
                "Student email is required when student login is enabled.",
            );
        }

        let userId: string | null = null;

        // ── 4. Create student login account ────────────────────────────────
        if (allowStudentLogin && dto.email) {

            // Prevent email from being attached to another user account
            const existingUser =
                await this.userRepository.findByEmail(dto.email);

            if (existingUser) {
                throw new ConflictError(
                    "A user with this email already exists.",
                );
            }

            // Generate temporary login credentials
            const tempPassword =
                this.passwordService.generateTemp();

            const passwordHash =
                await this.passwordService.hash(tempPassword);

            // Create public User account
            const user = await this.userRepository.create({
                schoolId,
                email: dto.email,
                passwordHash,
                role: Role.student,
                firstName: dto.firstName,
                lastName: dto.lastName,
                isActive: true,
                isEmailVerified: true,
                mustChangePassword: true,
            });

            userId = user.id;

            // Send login credentials
            await this.mailService.sendLetter(dto.email, {
                subject: "Welcome to the student portal — Your login details",
                title: "Your Student Account is Ready",
                greeting: `Hi ${dto.firstName},`,
                paragraphs: [
                    `A student account has been created for you on SchoolPortal.`,
                    `Your login credentials are:`,
                    `Email: <strong>${dto.email}</strong>`,
                    `Temporary Password: <strong>${tempPassword}</strong>`,
                    `Please change your password after your first login.`,
                ],
                footer:
                    "If you did not expect this email, please contact the school.",
            });
        }

        // ── 5. Create student record ──────────────────────────────────────
        const student = await this.studentRepository.create({
            userId,

            firstName: dto.firstName,
            lastName: dto.lastName,
            middleName: dto.middleName,

            admissionNumber: dto.admissionNumber,

            dateOfBirth: dto.dateOfBirth
                ? new Date(dto.dateOfBirth)
                : null,

            gender: dto.gender,
            bloodGroup: dto.bloodGroup,
            address: dto.address,
            religion: dto.religion,
            nationality: dto.nationality ?? "Nigerian",
            stateOfOrigin: dto.stateOfOrigin,

            admittedAt: dto.admittedAt
                ? new Date(dto.admittedAt)
                : new Date(),
        });

        return this.studentMapper.toResponse(student);
    }
}
