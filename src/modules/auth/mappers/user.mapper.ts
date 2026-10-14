import { User }             from "../../../generated/public/client";
import { IMapper }          from "../../../infrastructure/repository/base.repository";
import { UserEntity }       from "../domain/auth.entity";
import { UserResponseData } from "../types/auth.types";

export class UserMapper implements IMapper<User, UserEntity> {

    // passwordHash intentionally excluded
    toDomain(raw: User): UserEntity {
        return {
            id:                 raw.id,
            email:              raw.email,
            firstName:          raw.firstName,
            lastName:           raw.lastName,
            phone:              raw.phone,
            photoUrl:           raw.photoUrl,
            isActive:           raw.isActive,
            isEmailVerified:    raw.isEmailVerified,
            emailVerifiedAt:    raw.emailVerifiedAt,
            lastLoginAt:        raw.lastLoginAt,
            lastLoginIp:        raw.lastLoginIp,
            failedLoginCount:   raw.failedLoginCount,
            lockedUntil:        raw.lockedUntil,
            passwordChangedAt:  raw.passwordChangedAt,
            mustChangePassword: raw.mustChangePassword,
            createdAt:          raw.createdAt,
            updatedAt:          raw.updatedAt,
        };
    }

    toResponse(entity: UserEntity): UserResponseData {
        return {
            id:                 entity.id,
            email:              entity.email,
            firstName:          entity.firstName,
            lastName:           entity.lastName,
            phone:              entity.phone,
            photoUrl:           entity.photoUrl,
            isEmailVerified:    entity.isEmailVerified,
            mustChangePassword: entity.mustChangePassword,
        };
    }
}
