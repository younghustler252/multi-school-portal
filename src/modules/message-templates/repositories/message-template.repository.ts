import type { MessageChannel } from "../domain/template-engine";

export interface StoredTemplate {
    key: string; channel: MessageChannel; locale: string; subject: string | null; body: string;
    isActive: boolean; updatedById: string | null; updatedAt: Date;
}

export interface IMessageTemplateRepository {
    findAll(locale: string): Promise<StoredTemplate[]>;
    find(key: string, channel: MessageChannel, locale: string): Promise<StoredTemplate | null>;
    upsert(t: { key: string; channel: MessageChannel; locale: string; subject: string | null; body: string; isActive: boolean }, userId: string | null): Promise<StoredTemplate>;
    /** Returns true when a school version existed. */
    remove(key: string, channel: MessageChannel, locale: string): Promise<boolean>;
}
