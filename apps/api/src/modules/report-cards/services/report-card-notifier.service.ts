import type { NotificationDispatchService, OutgoingMessage } from "../../notifications/services/notification-dispatch.service";
import type { ChannelPolicyService } from "../../notifications/services/channel-policy.service";
import type { MessageTemplateService } from "../../message-templates/services/message-template.service";
import { renderPlain } from "../../message-templates/domain/template-engine";
import type { ISchoolRepository } from "../../school/repositories/school.repository";
import type { ReportCardsRepository } from "../repositories/report-cards.repository";
import { CardSnapshot } from "../domain/report-card.policy";

interface Dependencies {
    reportCardsRepository: ReportCardsRepository; notificationDispatchService: NotificationDispatchService; channelPolicyService: ChannelPolicyService;
    messageTemplateService: MessageTemplateService; schoolRepository: ISchoolRepository;
}
export const TEMPLATE_KEY = "report_card.ready";
const CHUNK = 200;

export interface PublishedCardRef { id: string; studentId: string; publishedAt: Date; snapshot: CardSnapshot }

/*
| TELL GUARDIANS a report card is ready (in-app, plus email / SMS when the plan and the school's preferences allow them).
| The wording is the school's own "report_card.ready" template. Each message carries an idempotency key (card, publication, guardian,
| channel), so telling twice never sends twice. A failure here never undoes the publishing: the caller keeps going.
*/
export class ReportCardNotifier {
    constructor(private readonly d: Dependencies) {}

    /** Returns the ids of the cards whose guardians were told (at least one message was built for them). */
    async notifyPublished(schoolId: string, actorUserId: string, cards: PublishedCardRef[]): Promise<{ told: string[]; created: number; duplicates: number }> {
        if (cards.length === 0) return { told: [], created: 0, duplicates: 0 };
        const d = this.d;
        const policy = await d.channelPolicyService.evaluate(schoolId, ["IN_APP", "EMAIL", "SMS"]);
        if (policy.allowed.length === 0) return { told: [], created: 0, duplicates: 0 };

        const [school, guardians] = await Promise.all([d.schoolRepository.findById(schoolId), d.reportCardsRepository.guardiansOf([...new Set(cards.map(c => c.studentId))])]);
        const def = d.messageTemplateService.definition(TEMPLATE_KEY);
        const texts = new Map<string, Awaited<ReturnType<MessageTemplateService["effective"]>>>();
        for (const c of policy.allowed) texts.set(c, await d.messageTemplateService.effective(TEMPLATE_KEY, c));

        const messages: OutgoingMessage[] = []; const told = new Set<string>();
        for (const card of cards) {
            const studentName = `${card.snapshot.student.firstName} ${card.snapshot.student.lastName}`.trim();
            for (const g of guardians.get(card.studentId) ?? []) {
                for (const channel of policy.allowed) {
                    if (channel === "EMAIL" && !g.email) continue;
                    if (channel === "SMS" && !g.phone) continue;
                    const plain = renderPlain(texts.get(channel)!, {
                        guardian_name: g.firstName, student_name: studentName, school_name: school?.name ?? "Your school",
                        term_name: `${card.snapshot.term} ${card.snapshot.session}`, class_name: card.snapshot.class.name,
                    });
                    if (plain.missing.length || !plain.body) continue;
                    messages.push({
                        type: def.notificationType, channel, title: plain.subject || "Report card ready", message: plain.body,
                        recipient: { recipientType: "GUARDIAN", recipientEntityId: g.id, userId: g.userId },
                        idempotencyKey: `report_card:${card.id}:${card.publishedAt.toISOString()}:${g.id}:${channel}`,
                    });
                    told.add(card.id);
                }
            }
        }
        let created = 0, duplicates = 0;
        for (let i = 0; i < messages.length; i += CHUNK) {
            const res = await d.notificationDispatchService.dispatch({
                sentById: actorUserId, targetType: "GUARDIAN", messages: messages.slice(i, i + CHUNK),
                metadata: { source: "report_cards", delivery: { skipGreeting: true, bodyOnly: true } },
            });
            created += res.created; duplicates += res.duplicates;
        }
        return { told: [...told], created, duplicates };
    }
}
