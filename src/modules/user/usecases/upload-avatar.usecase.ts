import { IUserRepository }        from "../../auth/repositories/user.repository";
import { UserProfileMapper }      from "../mappers/user.mapper";
import { UserProfileResponseData } from "../mappers/user.mapper";
import { SupabaseStorageService } from "../../../infrastructure/storage/supabase-storage.service";
import { NotFoundError }          from "../../../shared/errors/domain.errors";

interface Dependencies {
    userRepository:    IUserRepository;
    userProfileMapper: UserProfileMapper;
    storageService:    SupabaseStorageService;
}

export class UploadAvatarUseCase {
    private readonly userRepository:    IUserRepository;
    private readonly userProfileMapper: UserProfileMapper;
    private readonly storageService:    SupabaseStorageService;

    constructor({
        userRepository,
        userProfileMapper,
        storageService,
    }: Dependencies) {
        this.userRepository    = userRepository;
        this.userProfileMapper = userProfileMapper;
        this.storageService    = storageService;
    }

    async execute(
        userId: string,
        file: {
            buffer:   Buffer;
            mimetype: string;
            filename: string;
        },
    ): Promise<UserProfileResponseData> {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new NotFoundError("User");

        const result = await this.storageService.upload({
            folder:   `users/${userId}/avatar`,
            file:     file.buffer,
            mimetype: file.mimetype,
            filename: file.filename,
        });

        const updated = await this.userRepository.update(userId, {
            photoUrl: result.url,
        });

        return this.userProfileMapper.toResponse({
            ...updated,
            passwordChangedAt: null,
        });
    }
}