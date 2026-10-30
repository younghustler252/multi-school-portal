import { UserEntity } from "../../auth/domain/auth.entity";

export interface UserProfileResponseData {
    id:              string;
    email:           string;
    firstName:       string | null;
    lastName:        string | null;
    phone:           string | null;
    photoUrl:        string | null;
    isEmailVerified: boolean;
    lastLoginAt:     Date | null;
    createdAt:       Date;
    // Where this session is operating (authority comes from membership, not from the user row)
    session: {
        kind:          "school" | "platform";
        schoolId:      string | null;
        persona:       string | null;
        impersonating: boolean;
    };
}

export class UserProfileMapper {
    toResponse(
        entity: UserEntity,
        ctx: { schoolId: string | null; persona: string | null; impersonating: boolean },
    ): UserProfileResponseData {
        return {
            id:              entity.id,
            email:           entity.email,
            firstName:       entity.firstName,
            lastName:        entity.lastName,
            phone:           entity.phone,
            photoUrl:        entity.photoUrl,
            isEmailVerified: entity.isEmailVerified,
            lastLoginAt:     entity.lastLoginAt,
            createdAt:       entity.createdAt,
            session: {
                kind:          ctx.schoolId ? "school" : "platform",
                schoolId:      ctx.schoolId,
                persona:       ctx.persona,
                impersonating: ctx.impersonating,
            },
        };
    }
}
