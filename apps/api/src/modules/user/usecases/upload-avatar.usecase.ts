import { IUserRepository }    from "../../auth/repositories/user.repository";
import { AuthAuditService }   from "../../auth/services/auth-audit.service";
import { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { UserProfileMapper, UserProfileResponseData } from "../mappers/user.mapper";
import { userErrors }         from "../domain/user.errors";
import { UserActionContext }  from "../domain/user.types";

interface Dependencies {
    userRepository:    IUserRepository;
    userProfileMapper: UserProfileMapper;
    storageService:    SupabaseStorageService;
    authAuditService:  AuthAuditService;
}

const MAX_BYTES = 2 * 1024 * 1024;

// The client-supplied mimetype is not trusted: the file's first bytes must match an allowed image type
function sniffImage(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
    if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
    if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
    return null;
}

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export class UploadAvatarUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(
        ctx: UserActionContext, persona: string | null,
        file: { buffer: Buffer; mimetype: string; filename: string },
    ): Promise<UserProfileResponseData> {
        const d = this.d;
        const user = await d.userRepository.findById(ctx.userId);
        if (!user) throw userErrors.notFound();

        if (file.buffer.length === 0 || file.buffer.length > MAX_BYTES) throw userErrors.invalidImage();
        const type = sniffImage(file.buffer);
        if (!type) throw userErrors.invalidImage();

        const result = await d.storageService.upload({
            folder:   `users/${ctx.userId}/avatar`,
            file:     file.buffer,
            mimetype: type,                              // the sniffed type, not the claimed one
            filename: `avatar-${Date.now()}.${EXT[type]}`, // never the user-supplied name
        });

        const updated = await d.userRepository.update(ctx.userId, { photoUrl: result.url });
        await d.authAuditService.record({
            action: "user.avatar_changed", module: "user", userId: ctx.userId, schoolId: ctx.schoolId,
            actorMembershipId: ctx.membershipId, entity: "User", entityId: ctx.userId,
            ip: ctx.ip, userAgent: ctx.userAgent,
        });
        return d.userProfileMapper.toResponse(updated, { schoolId: ctx.schoolId, persona, impersonating: !!ctx.impersonatedBy });
    }
}
