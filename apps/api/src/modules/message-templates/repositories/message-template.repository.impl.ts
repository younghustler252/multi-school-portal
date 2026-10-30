import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { IMessageTemplateRepository, StoredTemplate } from "./message-template.repository";
import type { MessageChannel } from "../domain/template-engine";

/* Table repository without the base class: SchoolMessageTemplate has no mapper and no soft delete. Uses the tenant client. */
const toStored = (r: any): StoredTemplate => ({
    key: r.key, channel: r.channel, locale: r.locale, subject: r.subject ?? null, body: r.body,
    isActive: r.isActive, updatedById: r.updatedById ?? null, updatedAt: r.updatedAt,
});

export class MessageTemplateRepositoryImpl implements IMessageTemplateRepository {
    private get db() { return getTenantClient(); }

    async findAll(locale: string) {
        return (await this.db.schoolMessageTemplate.findMany({ where: { locale }, orderBy: [{ key: "asc" }, { channel: "asc" }] })).map(toStored);
    }
    async find(key: string, channel: MessageChannel, locale: string) {
        const r = await this.db.schoolMessageTemplate.findUnique({ where: { key_channel_locale: { key, channel, locale } } });
        return r ? toStored(r) : null;
    }
    async upsert(t: { key: string; channel: MessageChannel; locale: string; subject: string | null; body: string; isActive: boolean }, userId: string | null) {
        const data = { subject: t.subject, body: t.body, isActive: t.isActive, updatedById: userId };
        return toStored(await this.db.schoolMessageTemplate.upsert({
            where: { key_channel_locale: { key: t.key, channel: t.channel, locale: t.locale } },
            create: { key: t.key, channel: t.channel, locale: t.locale, ...data },
            update: data,
        }));
    }
    async remove(key: string, channel: MessageChannel, locale: string) {
        return (await this.db.schoolMessageTemplate.deleteMany({ where: { key, channel, locale } })).count > 0;
    }
}
