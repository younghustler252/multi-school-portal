import { IMessageTemplateRepository } from "../repositories/message-template.repository";
import { TEMPLATE_BY_KEY, TemplateDef } from "../domain/template-catalog";
import { MessageChannel, RenderedMessage, renderMessage } from "../domain/template-engine";
import { templateErrors } from "../domain/template.errors";

export const DEFAULT_LOCALE = "en";

export interface EffectiveTemplate { subject: string | null; body: string; isCustomized: boolean; updatedAt: Date | null }

/*
| MESSAGE TEMPLATE SERVICE: what the automation and notification code asks ("give me the fee reminder, by email, with these values").
| The school's own ACTIVE text wins; otherwise the default from the catalog. A school version that was switched off (isActive false)
| is kept but ignored. Remembers nothing between calls (one instance serves every school).
*/
export class MessageTemplateService {
    constructor(private readonly d: { messageTemplateRepository: IMessageTemplateRepository }) {}

    definition(key: string): TemplateDef {
        const def = TEMPLATE_BY_KEY.get(key);
        if (!def) throw templateErrors.unknownTemplate(key);
        return def;
    }

    async effective(key: string, channel: MessageChannel): Promise<EffectiveTemplate> {
        const def = this.definition(key);
        const own = await this.d.messageTemplateRepository.find(key, channel, DEFAULT_LOCALE);
        if (own && own.isActive) return { subject: own.subject, body: own.body, isCustomized: true, updatedAt: own.updatedAt };
        return { ...def.defaults[channel], isCustomized: false, updatedAt: null };
    }

    /** The message ready to send. `notificationType` is how the in-app copy is stored. */
    async render(key: string, channel: MessageChannel, values: Record<string, unknown>): Promise<RenderedMessage & { notificationType: TemplateDef["notificationType"] }> {
        const def = this.definition(key);
        const text = await this.effective(key, channel);
        return { ...renderMessage(channel, text, values), notificationType: def.notificationType };
    }
}
