// import { IUserRepository }  from "../../../auth/repositories/user.repository";
// import { PasswordService }  from "../../../../shared/services/password.service";
// import { MailService }      from "../../../../infrastructure/mail/mail.service";
// import { AuditService }     from "../../../audit/services/audit.service";
// import { NotFoundError }    from "../../../../shared/errors/domain.errors";
// import { Role }             from "../../../../generated/public";

// interface Dependencies {
//     userRepository:  IUserRepository;
//     passwordService: PasswordService;
//     mailService:     MailService;
//     auditService:    AuditService;
// }

// export class ResetSchoolAdminPasswordUseCase {
//     private readonly userRepository:  IUserRepository;
//     private readonly passwordService: PasswordService;
//     private readonly mailService:     MailService;
//     private readonly auditService:    AuditService;

//     constructor({
//         userRepository,
//         passwordService,
//         mailService,
//         auditService,
//     }: Dependencies) {
//         this.userRepository  = userRepository;
//         this.passwordService = passwordService;
//         this.mailService     = mailService;
//         this.auditService    = auditService;
//     }

//     async execute(
//         schoolId:          string,
//         resetByAdminId:    string,
//     ) {
//         // ── Find school admin ─────────────────────────────────────────────
//         const admin = await this.userRepository.findOne({
//             schoolId,
//             role: Role.school_admin,
//         });

//         if (!admin) throw new NotFoundError("School admin not found");

//         // ── Generate temporary password ───────────────────────────────────
//         const tempPassword = this.passwordService.generateTemp?.()
//             ?? this.generateFallback();

//         const passwordHash = await this.passwordService.hash(tempPassword);

//         // ── Reset password ────────────────────────────────────────────────
//         await this.userRepository.update(admin.id, {
//             passwordHash,
//             mustChangePassword: true,
//         });

//         // ── Audit password reset ──────────────────────────────────────────
//         await this.auditService.log({
//             userId:   resetByAdminId,
//             schoolId,
//             action:   "school_admin.password_reset",
//             entity:   "User",
//             entityId: admin.id,
//             metadata: {
//                 targetUserId: admin.id,
//                 targetRole:   admin.role,
//                 mustChangePassword: true,
//             },
//         });

//         // ── Send temporary password ───────────────────────────────────────
//         await this.mailService.sendLetter(admin.email, {
//             subject:  "Your password has been reset",
//             title:    "Password Reset by Support",
//             greeting: `Hi ${admin.firstName ?? "there"},`,
//             paragraphs: [
//                 `Your account password was reset by SchoolPortal support.`,
//                 `Temporary password: <strong>${tempPassword}</strong>`,
//                 `You'll be asked to set a new password on your next login.`,
//             ],
//             footer: "If you did not request this, contact support immediately.",
//         });

//         return {
//             message: `Password reset for ${admin.email}`,
//         };
//     }

//     private generateFallback(): string {
//         const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
//         let p = "";

//         for (let i = 0; i < 10; i++) {
//             p += chars[Math.floor(Math.random() * chars.length)];
//         }

//         return p;
//     }
// }
