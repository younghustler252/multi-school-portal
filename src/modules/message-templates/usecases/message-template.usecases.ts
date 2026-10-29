import { IMessageTemplateRepository } from "../repositories/message-template.repository";
import { DEFAULT_LOCALE, MessageTemplateService } from "../services/message-template.service";
import { CHANNELS, TEMPLATE_CATALOG, TemplateDef, sampleValues, variableNames } from "../domain/template-catalog";
import { MessageChannel, renderMessage, smsLength, validateTemplateText } from "../domain/template-engine";
import { templateErrors } from "../domain/template.errors";
import { EntitlementsService } from "../../../foundation/entitlements.service";
import { AuditService } from "../../audit/services/audit.service";
import { SaveTemplateDtoType, PreviewTemplateDtoType } from "../dtos/message-template.dto";

interface Dependencies {
    messageTemplateRepository: IMessageTemplateRepository;
    messageTemplateService:    MessageTemplateService;
    entitlementsService:       EntitlementsService;
    auditService:              AuditService;
}

/** "email", "EMAIL" and "in_app" in a URL all work. */
export function normalizeChannel(raw: string): MessageChannel {
    const c = String(raw ?? "").toUpperCase().replace("-", "_") as MessageChannel;
    if (!CHANNELS.includes(c)) throw templateErrors.invalid([`Unknown channel "${raw}". Use in_app, email or sms`]);
    return c;
}

const FEATURE_FOR: Partial<Record<MessageChannel, string>> = { EMAIL: "notifications.email", SMS: "notifications.sms" };

const view = (def: TemplateDef, stored: Map<string, { subject: string | null; body: string; isActive: boolean; updatedAt: Date }>) => ({
    key: def.key, name: def.name, description: def.description,
    variables: def.variables.map(v => ({ name: v.name, label: v.label, sample: v.sample })),
    channels: CHANNELS.map(channel => {
        const own = stored.get(`${def.key}:${channel}`);
        const custom = !!own && own.isActive;
        const text = custom ? own! : { ...def.defaults[channel], updatedAt: null };
        return {
            channel, subject: text.subject, body: text.body, isCustomized: custom,
            hasSavedVersion: !!own, isActive: own ? own.isActive : true, default: def.defaults[channel], updatedAt: text.updatedAt,
        };
    }),
});

export class ListMessageTemplatesUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute() {
        const rows = await this.d.messageTemplateRepository.findAll(DEFAULT_LOCALE);
        const stored = new Map(rows.map(r => [`${r.key}:${r.channel}`, r]));
        return { templates: TEMPLATE_CATALOG.map(def => view(def, stored)) };
    }
}

export class GetMessageTemplateUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(key: string) {
        const def = this.d.messageTemplateService.definition(key);
        const rows = await this.d.messageTemplateRepository.findAll(DEFAULT_LOCALE);
        return view(def, new Map(rows.map(r => [`${r.key}:${r.channel}`, r])));
    }
}

/*
| SAVE the school's own words for one message on one channel. Checked against the message's own placeholders first.
| Email and SMS need the plan feature for that channel (in-app is always allowed). The audit entry keeps the old and new text.
*/
export class SaveMessageTemplateUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, actorUserId: string, key: string, channelRaw: string, dto: SaveTemplateDtoType) {
        const def = this.d.messageTemplateService.definition(key);
        const channel = normalizeChannel(channelRaw);

        const problems = validateTemplateText(channel, dto, variableNames(def));
        if (problems.length) throw templateErrors.invalid(problems);

        const feature = FEATURE_FOR[channel];
        if (feature) {
            const decision = await this.d.entitlementsService.checkFeature(schoolId, feature);
            if (!decision.allowed) throw templateErrors.channelNotInPlan(channel, feature);
        }

        const before = await this.d.messageTemplateRepository.find(key, channel, DEFAULT_LOCALE);
        await this.d.messageTemplateRepository.upsert({
            key, channel, locale: DEFAULT_LOCALE,
            subject: channel === "SMS" ? null : (dto.subject ?? "").trim(),
            body: dto.body.trim(), isActive: dto.isActive ?? true,
        }, actorUserId);
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "message_templates.updated", entity: "SchoolMessageTemplate", entityId: `${key}:${channel}`,
            oldValue: before ? { subject: before.subject, body: before.body, isActive: before.isActive } : null,
            newValue: { subject: dto.subject ?? null, body: dto.body.trim(), isActive: dto.isActive ?? true },
        });
        return new GetMessageTemplateUseCase(this.d).execute(key);
    }
}

/* RESET: delete the school's version so the platform default applies again. Safe to repeat. */
export class ResetMessageTemplateUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, actorUserId: string, key: string, channelRaw: string) {
        this.d.messageTemplateService.definition(key);
        const channel = normalizeChannel(channelRaw);
        const removed = await this.d.messageTemplateRepository.remove(key, channel, DEFAULT_LOCALE);
        if (removed) {
            await this.d.auditService.log({
                userId: actorUserId, schoolId, action: "message_templates.reset", entity: "SchoolMessageTemplate", entityId: `${key}:${channel}`,
            });
        }
        return new GetMessageTemplateUseCase(this.d).execute(key);
    }
}

/*
| PREVIEW a draft (or the current text when nothing is sent) filled with sample values. Nothing is saved or sent.
| An SMS preview also says how many messages it will cost.
*/
export class PreviewMessageTemplateUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(key: string, channelRaw: string, dto: PreviewTemplateDtoType) {
        const def = this.d.messageTemplateService.definition(key);
        const channel = normalizeChannel(channelRaw);
        const current = await this.d.messageTemplateService.effective(key, channel);
        const draft = { subject: dto.subject === undefined ? current.subject : dto.subject, body: dto.body ?? current.body };

        const problems = validateTemplateText(channel, draft, variableNames(def));
        if (problems.length) throw templateErrors.invalid(problems);

        const rendered = renderMessage(channel, draft, sampleValues(def));
        return {
            channel, subject: rendered.subject, body: channel === "EMAIL" ? rendered.paragraphs.join("\n\n") : rendered.body,
            paragraphs: rendered.paragraphs, usesSampleData: true,
            ...(channel === "SMS" && { sms: smsLength(rendered.body) }),
        };
    }
}
