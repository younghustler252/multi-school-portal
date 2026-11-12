import { AuditService } from "../../audit/services/audit.service";
import { preferencesOf, PreferencesReader } from "../../../foundation/settings.registry";
import { AudienceRecipientService, ResolvedRecipient } from "../../notifications/services/audience-recipient.service";
import { NotificationDispatchService, DispatchChannel, OutgoingMessage } from "../../notifications/services/notification-dispatch.service";
import { ChannelPolicyService } from "../../notifications/services/channel-policy.service";
import { IEventRepository } from "../repositories/event.repository";
import type { CalendarEventEntity } from "../domain/event.entity";
import { NoticeKind, buildEventMessage, buildReminderMessage, noticeKey, targetTypeOf, wantsOf } from "../domain/event.notice";
import { reminderKey } from "../domain/event.reminders";

export const EVENT_NOTICES_SETTING = "events.notifications_enabled";
export type NoticeOutcome =
    | { sent: false; reason: "notifications_disabled" | "no_channels" | "no_recipients" }
    | { sent: true; recipients: number; created: number; duplicates: number; byChannel: Record<DispatchChannel, number>; blockedChannels: { channel: DispatchChannel; reason: string }[] };

interface Deps {
    eventRepository: IEventRepository; audienceRecipientService: AudienceRecipientService; notificationDispatchService: NotificationDispatchService;
    channelPolicyService: ChannelPolicyService; auditService: AuditService; schoolPreferencesService?: PreferencesReader;
}

/*
| EVENT NOTICES: the one place an event tells its audience something. It goes through the same road as every school message:
|  - the master switch events.notifications_enabled (default OFF) is read at the moment of sending;
|  - channels come from the event, then the plan and the school's Messages settings decide what is allowed (in-app always is);
|  - people come from the event's audience through AudienceRecipientService (the same rules announcements use);
|  - every person/channel/notice has a stable idempotency key, so a repeated call, retry or manual "notify" never sends twice.
*/
export class EventNoticeService {
    constructor(private readonly d: Deps) {}

    async enabled(): Promise<boolean> { return (await preferencesOf(this.d))[EVENT_NOTICES_SETTING] === true; }

    async send(schoolId: string, event: CalendarEventEntity, kind: NoticeKind, actorUserId: string): Promise<NoticeOutcome> {
        const out = await this.deliver(schoolId, event, actorUserId, {
            text: buildEventMessage(kind, event), keyOf: (t, id, ch) => noticeKey(event, kind, t, id, ch),
            metadata: { source: "event", eventId: event.id, kind, revision: event.revision }, audit: { kind, revision: event.revision },
        });
        if (kind === "published" && out.sent && out.created > 0 && !event.publishNoticeSentAt) {
            await this.d.eventRepository.update(event.id, { data: { publishNoticeSentAt: new Date() } });
        }
        return out;
    }

    /** A reminder: the same road and rules as any notice, with its own key per revision and offset. */
    async sendReminder(schoolId: string, event: CalendarEventEntity, offsetMinutes: number, actorUserId: string): Promise<NoticeOutcome> {
        return this.deliver(schoolId, event, actorUserId, {
            text: buildReminderMessage(event, offsetMinutes), keyOf: (t, id, ch) => reminderKey(event, offsetMinutes, t, id, ch),
            metadata: { source: "event", eventId: event.id, kind: "reminder", revision: event.revision, offsetMinutes }, audit: { kind: "reminder", revision: event.revision, offsetMinutes },
        });
    }

    private async deliver(schoolId: string, event: CalendarEventEntity, actorUserId: string, o: {
        text: { title: string; message: string }; keyOf: (recipientType: string, recipientId: string, channel: string) => string;
        metadata: Record<string, unknown>; audit: Record<string, unknown>;
    }): Promise<NoticeOutcome> {
        if (!(await this.enabled())) return { sent: false, reason: "notifications_disabled" };

        const decision = await this.d.channelPolicyService.evaluate(schoolId, event.notifyChannels as DispatchChannel[]);
        const channels = decision.allowed;
        const blockedChannels = decision.blocked.map(b => ({ channel: b.channel, reason: b.reason }));
        if (channels.length === 0) return { sent: false, reason: "no_channels" };

        const w = wantsOf(event.audienceKinds);
        const people = await this.d.audienceRecipientService.resolve({
            wantsStudents: w.students, wantsGuardians: w.guardians, wantsStaff: w.staff,
            filter: { branchIds: event.branchIds, classIds: event.classIds, staffCategories: w.staffCategories },
        });
        if (people.length === 0) return { sent: false, reason: "no_recipients" };

        const type = event.isHoliday ? "holiday" : "event";
        const messages: OutgoingMessage[] = [];
        for (const p of people as ResolvedRecipient[]) {
            for (const channel of channels) {
                if (channel === "EMAIL" && !p.email) continue;
                if (channel === "SMS" && !p.phone) continue;
                messages.push({ type, channel, ...o.text, recipient: { recipientType: p.type, recipientEntityId: p.id, userId: p.userId }, idempotencyKey: o.keyOf(p.type, p.id, channel) });
            }
        }
        const result = await this.d.notificationDispatchService.dispatch({ sentById: actorUserId, targetType: targetTypeOf(event.audienceKinds), messages, metadata: o.metadata });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "calendar_event.notified", entity: "CalendarEvent", entityId: event.id,
            newValue: { ...o.audit, recipients: people.length, created: result.created, duplicates: result.duplicates, byChannel: result.byChannel, blockedChannels },
        });
        return { sent: true, recipients: people.length, created: result.created, duplicates: result.duplicates, byChannel: result.byChannel, blockedChannels };
    }

    /** How many people an event would reach (nothing is sent). */
    async preview(event: CalendarEventEntity) {
        const w = wantsOf(event.audienceKinds);
        const people = await this.d.audienceRecipientService.resolve({
            wantsStudents: w.students, wantsGuardians: w.guardians, wantsStaff: w.staff,
            filter: { branchIds: event.branchIds, classIds: event.classIds, staffCategories: w.staffCategories },
        });
        const by = (t: string) => people.filter(p => p.type === t).length;
        return {
            total: people.length, students: by("STUDENT"), guardians: by("GUARDIAN"), staff: by("STAFF"),
            withEmail: people.filter(p => !!p.email).length, withPhone: people.filter(p => !!p.phone).length,
        };
    }
}
