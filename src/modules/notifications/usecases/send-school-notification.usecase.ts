import { IStudentRepository }             from "../../students/repositories/student.repository";
import { IGuardianRepository }            from "../../guardians/repositories/guardian.repository";
import { IStaffRepository }               from "../../staff/repositories/staff.repository";
import { IUserRepository }                from "../../auth/repositories/user.repository";
import { SchoolNotificationMapper, SchoolNotificationResponseData } from "../mappers/notification.mapper";
import { SendSchoolNotificationDtoType }  from "../dtos/notification.dto";
import { INotificationRepository }        from "../repositories/notification.repository";
import { DispatchChannel, NotificationDispatchService, OutgoingMessage } from "../services/notification-dispatch.service";
import { ACTIVE_STUDENT_WHERE, guardianAnnouncementWhere } from "../../students/domain/student-eligibility";
import { EntitlementsService }            from "../../../foundation/entitlements.service";
import { preferencesOf, PreferencesReader } from "../../../foundation/settings.registry";
import { AuditService }                   from "../../audit/services/audit.service";
import { notificationErrors }             from "../domain/notification.errors";
import { RecipientKind }                  from "../domain/notification.entity";

interface Dependencies {
    notificationRepository:   INotificationRepository;
    studentRepository:        IStudentRepository;
    guardianRepository:       IGuardianRepository;
    staffRepository:          IStaffRepository;
    userRepository:           IUserRepository;
    schoolNotificationMapper: SchoolNotificationMapper;
    notificationDispatchService: NotificationDispatchService;
    entitlementsService:      EntitlementsService;
    auditService:             AuditService;
    schoolPreferencesService?: PreferencesReader;
}

interface ResolvedRecipient { type: RecipientKind; id: string; userId: string | null; email: string | null; phone: string | null }

const PLAN_FEATURE: Partial<Record<DispatchChannel, string>> = { EMAIL: "notifications.email", SMS: "notifications.sms" };
const PREFERENCE:   Partial<Record<DispatchChannel, string>> = { EMAIL: "notifications.email_enabled", SMS: "notifications.sms_enabled" };

/*
| SEND an announcement. Every requested channel must be allowed by BOTH the plan (notifications.email / notifications.sms)
| and the school's own preference (notifications.email_enabled / notifications.sms_enabled); in-app is always allowed.
| If one is not, the request is refused with the reason, rather than quietly sending less than the sender asked for.
| One row per person and channel; a person with no email (or phone) simply gets no email (or SMS) row.
| All messages go through the dispatch service (rows first, then the delivery queue).
*/
export class SendSchoolNotificationUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: SendSchoolNotificationDtoType, schoolId: string, actorUserId: string): Promise<SchoolNotificationResponseData & { recipients: number; byChannel: Record<string, number> }> {
        const channels = [...new Set(dto.channels)] as DispatchChannel[];
        await this.assertChannelsAllowed(schoolId, channels);

        const people = await this.resolveRecipients(dto);
        if (people.length === 0) throw notificationErrors.noRecipients();

        const messages: OutgoingMessage[] = [];
        for (const p of people) {
            for (const channel of channels) {
                if (channel === "EMAIL" && !p.email) continue;
                if (channel === "SMS" && !p.phone) continue;
                messages.push({
                    type: dto.type, channel, title: dto.title.trim(), message: dto.message.trim(),
                    recipient: { recipientType: p.type, recipientEntityId: p.id, userId: p.userId },
                });
            }
        }

        const result = await this.d.notificationDispatchService.dispatch({
            sentById: actorUserId, targetType: dto.targetType, messages,
            metadata: { ...(dto.metadata ?? {}), source: "manual" },
        });
        const first = result.notificationIds[0];
        const notification = await this.d.notificationRepository.findSchoolNotificationById(first);

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "notifications.sent", entity: "SchoolNotification", entityId: first,
            newValue: { type: dto.type, targetType: dto.targetType, channels, recipients: people.length, byChannel: result.byChannel },
        });
        return { ...this.d.schoolNotificationMapper.toResponse(notification!), recipients: people.length, byChannel: result.byChannel };
    }

    private async assertChannelsAllowed(schoolId: string, channels: DispatchChannel[]): Promise<void> {
        const prefs = await preferencesOf(this.d);
        const blocked: { channel: string; reason: "plan" | "school_setting" }[] = [];
        for (const channel of channels) {
            const feature = PLAN_FEATURE[channel];
            if (!feature) continue;
            const decision = await this.d.entitlementsService.checkFeature(schoolId, feature);
            if (!decision.allowed) { blocked.push({ channel, reason: "plan" }); continue; }
            if (prefs[PREFERENCE[channel]!] !== true) blocked.push({ channel, reason: "school_setting" });
        }
        if (blocked.length) throw notificationErrors.channelUnavailable(blocked);
    }

    private async resolveRecipients(dto: SendSchoolNotificationDtoType): Promise<ResolvedRecipient[]> {
        const out: ResolvedRecipient[] = [];
        const wantsStudents  = ["STUDENT", "ALL_STUDENTS", "EVERYONE"].includes(dto.targetType);
        const wantsGuardians = ["GUARDIAN", "ALL_PARENTS", "EVERYONE"].includes(dto.targetType);
        const wantsStaff     = ["STAFF", "ALL_STAFF", "EVERYONE"].includes(dto.targetType);

        if (wantsStudents) {
            const students = dto.studentIds?.length
                ? await this.d.studentRepository.findMany({ id: { in: dto.studentIds } })
                : await this.d.studentRepository.findMany(dto.includeGraduates ? { isActive: true } : { ...ACTIVE_STUDENT_WHERE });
            const userIds = students.map(s => s.userId).filter(Boolean) as string[];
            const users = userIds.length ? await this.d.userRepository.findByIds(userIds) : [];
            const byId = new Map(users.map(u => [u.id, u]));
            for (const s of students) {
                const u = s.userId ? byId.get(s.userId) : null;
                out.push({ type: "STUDENT", id: s.id, userId: s.userId ?? null, email: u?.email ?? null, phone: u?.phone ?? null });
            }
        }
        if (wantsGuardians) {
            const guardians = dto.guardianIds?.length
                ? await this.d.guardianRepository.findMany({ id: { in: dto.guardianIds } })
                : await this.d.guardianRepository.findMany(guardianAnnouncementWhere(!!dto.includeGraduates));
            for (const g of guardians) out.push({ type: "GUARDIAN", id: g.id, userId: (g as any).userId ?? null, email: g.email ?? null, phone: g.phone ?? null });
        }
        if (wantsStaff) {
            const staff = dto.staffIds?.length
                ? await this.d.staffRepository.findMany({ id: { in: dto.staffIds } })
                : await this.d.staffRepository.findMany({ isActive: true });
            const userIds = staff.map(s => s.userId).filter(Boolean) as string[];
            const users = userIds.length ? await this.d.userRepository.findByIds(userIds) : [];
            const byId = new Map(users.map(u => [u.id, u]));
            for (const s of staff) {
                const u = s.userId ? byId.get(s.userId) : null;
                out.push({ type: "STAFF", id: s.id, userId: s.userId ?? null, email: u?.email ?? null, phone: u?.phone ?? null });
            }
        }
        return out;
    }
}
