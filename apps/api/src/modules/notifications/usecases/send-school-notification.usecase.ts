import { SchoolNotificationMapper, SchoolNotificationResponseData } from "../mappers/notification.mapper";
import { SendSchoolNotificationDtoType }  from "../dtos/notification.dto";
import { INotificationRepository }        from "../repositories/notification.repository";
import { DispatchChannel, NotificationDispatchService, OutgoingMessage } from "../services/notification-dispatch.service";
import { EntitlementsService }            from "../../../foundation/entitlements.service";
import { PreferencesReader } from "../../../foundation/settings.registry";
import { ChannelPolicyService } from "../services/channel-policy.service";
import { AuditService }                   from "../../audit/services/audit.service";
import { notificationErrors }             from "../domain/notification.errors";
import type { Access }                   from "../../../foundation/access.service";
import { IClassRepository }              from "../../classes/repositories/class.repository";
import { AudienceRecipientService } from "../services/audience-recipient.service";
import { resolveAudience } from "../domain/audience";

interface Dependencies {
    notificationRepository:   INotificationRepository;
    audienceRecipientService: AudienceRecipientService;     // who the audience is: shared with other features that message groups
    schoolNotificationMapper: SchoolNotificationMapper;
    notificationDispatchService: NotificationDispatchService;
    entitlementsService:      EntitlementsService;
    auditService:             AuditService;
    schoolPreferencesService?: PreferencesReader;
    channelPolicyService?:    ChannelPolicyService;
    classRepository?:         Pick<IClassRepository, "findAllClasses">;   // only needed to check which branch a chosen class is in
}

/*
| SEND an announcement. Every requested channel must be allowed by BOTH the plan (notifications.email / notifications.sms)
| and the school's own preference (notifications.email_enabled / notifications.sms_enabled); in-app is always allowed.
| If one is not, the request is refused with the reason, rather than quietly sending less than the sender asked for.
| One row per person and channel; a person with no email (or phone) simply gets no email (or SMS) row.
| All messages go through the dispatch service (rows first, then the delivery queue).
| A group message can be narrowed by branch and class; a sender with BRANCH scope reaches only their own branches (domain/audience.ts).
*/
export class SendSchoolNotificationUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: SendSchoolNotificationDtoType, schoolId: string, actorUserId: string, access?: Access): Promise<SchoolNotificationResponseData & { recipients: number; byChannel: Record<string, number>; skippedNoContact: number }> {
        const channels = [...new Set(dto.channels)] as DispatchChannel[];
        await this.assertChannelsAllowed(schoolId, channels);

        const classBranch = dto.classIds?.length && this.d.classRepository
            ? new Map((await this.d.classRepository.findAllClasses()).map(c => [c.id, c.branchId])) : new Map<string, string>();
        const { filter, limited } = resolveAudience(access, dto, classBranch);
        const people = await this.d.audienceRecipientService.resolve({
            wantsStudents:  ["STUDENT", "ALL_STUDENTS", "EVERYONE"].includes(dto.targetType),
            wantsGuardians: ["GUARDIAN", "ALL_PARENTS", "EVERYONE"].includes(dto.targetType),
            wantsStaff:     ["STAFF", "ALL_STAFF", "EVERYONE"].includes(dto.targetType),
            studentIds: dto.studentIds, guardianIds: dto.guardianIds, staffIds: dto.staffIds,
            includeGraduates: dto.includeGraduates, filter, limited,
        });
        if (people.length === 0) throw notificationErrors.noRecipients();

        const messages: OutgoingMessage[] = [];
        let skippedNoContact = 0;                                // person + channel pairs left out because there is no email address / phone number
        for (const p of people) {
            for (const channel of channels) {
                if ((channel === "EMAIL" && !p.email) || (channel === "SMS" && !p.phone)) { skippedNoContact++; continue; }
                messages.push({
                    type: dto.type, channel, title: dto.title.trim(), message: dto.message.trim(),
                    recipient: { recipientType: p.type, recipientEntityId: p.id, userId: p.userId },
                });
            }
        }

        // Nothing to send: say so (REM-094). Without this the dispatcher returns no notification and the code below would look one up by `undefined`.
        if (messages.length === 0) throw notificationErrors.noDeliverableRecipients(people.length, skippedNoContact);

        const result = await this.d.notificationDispatchService.dispatch({
            sentById: actorUserId, targetType: dto.targetType, messages,
            metadata: { ...(dto.metadata ?? {}), source: "manual" },
        });
        const first = result.notificationIds[0];
        if (!first) throw notificationErrors.noDeliverableRecipients(people.length, skippedNoContact);
        const notification = await this.d.notificationRepository.findSchoolNotificationById(first);

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "notifications.sent", entity: "SchoolNotification", entityId: first,
            newValue: { type: dto.type, targetType: dto.targetType, channels, recipients: people.length, byChannel: result.byChannel, skippedNoContact, branches: filter.branchIds ?? null, classes: dto.classIds ?? null },
        });
        return { ...this.d.schoolNotificationMapper.toResponse(notification!), recipients: people.length, byChannel: result.byChannel, skippedNoContact };
    }

    private async assertChannelsAllowed(schoolId: string, channels: DispatchChannel[]): Promise<void> {
        const policy = this.d.channelPolicyService ?? new ChannelPolicyService(this.d);
        const { blocked } = await policy.evaluate(schoolId, channels);
        if (blocked.length) throw notificationErrors.channelUnavailable(blocked);
    }
}
