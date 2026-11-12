import type { Access } from "../../../foundation/access.service";
import { AuditService } from "../../audit/services/audit.service";
import type { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { sniffFile, FILE_EXTENSION } from "../../../shared/utils/file-sniff";
import { IEventRepository } from "../repositories/event.repository";
import { eventErrors } from "../domain/event.errors";
import { assertCanActOnEvent } from "../domain/event.scope";
import { EventMapper, EventResponseData } from "../mappers/event.mapper";

/* COVER IMAGE (optional). Same rules as the school logo: JPEG, PNG or WebP judged by the file's own bytes, at most 2 MB; SVG is refused (it can carry scripts). */
export const MAX_COVER_BYTES = 2 * 1024 * 1024;
interface Deps { eventRepository: IEventRepository; eventMapper: EventMapper; storageService: Pick<SupabaseStorageService, "upload">; eventCoverBucket: string; auditService: AuditService }
const respond = (d: Pick<Deps, "eventMapper">, e: any): EventResponseData => d.eventMapper.toResponse(e);

export class UploadEventCoverUseCase {
    constructor(private readonly d: Deps) {}
    async execute(schoolId: string, id: string, file: { buffer: Buffer }, actorUserId: string, access?: Access): Promise<EventResponseData> {
        const event = await this.d.eventRepository.findById(id);
        if (!event) throw eventErrors.notFound();
        assertCanActOnEvent(access, "events.manage", event);
        if (event.status === "CANCELLED") throw eventErrors.cancelled();
        const type = sniffFile(file.buffer);
        if (file.buffer.length > MAX_COVER_BYTES || !type || type === "application/pdf") throw eventErrors.invalidImage();
        const result = await this.d.storageService.upload({
            bucket: this.d.eventCoverBucket, folder: `schools/${schoolId}/events`,
            file: file.buffer, mimetype: type, filename: `cover-${id}-${Date.now()}.${FILE_EXTENSION[type]}`,
        });
        const updated = await this.d.eventRepository.update(id, { data: { coverImageUrl: result.url, updatedById: actorUserId } });
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "calendar_event.cover_changed", entity: "CalendarEvent", entityId: id });
        return respond(this.d, updated);
    }
}

export class RemoveEventCoverUseCase {
    constructor(private readonly d: Omit<Deps, "storageService">) {}
    async execute(schoolId: string, id: string, actorUserId: string, access?: Access): Promise<EventResponseData> {
        const event = await this.d.eventRepository.findById(id);
        if (!event) throw eventErrors.notFound();
        assertCanActOnEvent(access, "events.manage", event);
        if (event.status === "CANCELLED") throw eventErrors.cancelled();
        if (!event.coverImageUrl) return respond(this.d, event);
        const updated = await this.d.eventRepository.update(id, { data: { coverImageUrl: null, updatedById: actorUserId } });
        await this.d.auditService.log({ userId: actorUserId, schoolId, action: "calendar_event.cover_removed", entity: "CalendarEvent", entityId: id });
        return respond(this.d, updated);
    }
}
