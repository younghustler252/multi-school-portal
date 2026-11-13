import { IPlatformSettingsRepository } from "../repositories/platform-settings.repository";
import { PlatformSettingsMapper, PlatformSettingsResponseData } from "../mappers/platform-settings.mapper";
import { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { AuditService } from "../../audit/services/audit.service";
import { ActorType } from "../../audit/domain/audit.enums";
import { sniffFile, FILE_EXTENSION } from "../../../shared/utils/file-sniff";
import { AppError } from "../../../shared/errors/domain.errors";
import { env } from "../../../config/env";

interface Dependencies {
    platformSettingsRepository: IPlatformSettingsRepository;
    platformSettingsMapper:     PlatformSettingsMapper;
    storageService:             SupabaseStorageService;
    auditService:               AuditService;
}

const MAX_BYTES = 2 * 1024 * 1024;
const FOLDER = "platform/logos";   // only this folder is ever written to or cleaned up by this feature
const invalidImage = (msg = "Upload a JPEG, PNG or WebP image up to 2 MB") => new AppError(msg, 400, true, "INVALID_IMAGE");

/** The storage path of a link that points into our public bucket's platform folder; null for anything else. */
export function platformLogoPathOf(url: string | null | undefined): string | null {
    if (!url) return null;
    const marker = `/${env.supabase.publicBucket}/`;
    const at = url.indexOf(marker);
    if (at < 0) return null;
    const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0] ?? "");
    return path.startsWith(`${FOLDER}/`) && !path.includes("..") ? path : null;
}

/*
| UPLOAD THE PLATFORM LOGO (super admin). Same rules as a school logo: JPEG, PNG or WebP up to 2 MB, judged by the
| file's own bytes; SVG is refused (it can carry scripts). It goes in our own public bucket, so the link is always ours.
| The old file is removed afterwards, but only if it lives in this feature's folder (a failed clean-up never fails the upload).
*/
export class UploadPlatformLogoUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(actorUserId: string, file: { buffer: Buffer }): Promise<PlatformSettingsResponseData> {
        const type = sniffFile(file.buffer);
        if (file.buffer.length > MAX_BYTES || !type || type === "application/pdf") throw invalidImage();

        const before = await this.d.platformSettingsRepository.find();
        const result = await this.d.storageService.upload({
            bucket: env.supabase.publicBucket, folder: FOLDER,
            file: file.buffer, mimetype: type, filename: `logo-${Date.now()}.${FILE_EXTENSION[type]}`,
        });
        const updated = await this.d.platformSettingsRepository.setLogo(result.url);

        const oldPath = platformLogoPathOf(before.logoUrl);
        if (oldPath) await this.d.storageService.delete(oldPath, env.supabase.publicBucket).catch(() => undefined);

        await this.d.auditService.log({ userId: actorUserId, actorType: ActorType.SUPER_ADMIN, schoolId: null, action: "platform.logo_changed", entity: "PlatformSettings", entityId: updated.id });
        return this.d.platformSettingsMapper.toResponse(updated);
    }
}

/* CLEAR THE PLATFORM LOGO (super admin). Safe to repeat: clearing an empty logo just returns the settings. */
export class RemovePlatformLogoUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(actorUserId: string): Promise<PlatformSettingsResponseData> {
        const before = await this.d.platformSettingsRepository.find();
        if (!before.logoUrl) return this.d.platformSettingsMapper.toResponse(before);

        const updated = await this.d.platformSettingsRepository.setLogo(null);
        const oldPath = platformLogoPathOf(before.logoUrl);
        if (oldPath) await this.d.storageService.delete(oldPath, env.supabase.publicBucket).catch(() => undefined);

        await this.d.auditService.log({ userId: actorUserId, actorType: ActorType.SUPER_ADMIN, schoolId: null, action: "platform.logo_removed", entity: "PlatformSettings", entityId: updated.id });
        return this.d.platformSettingsMapper.toResponse(updated);
    }
}
