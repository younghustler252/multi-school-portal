import { User } from "../../../generated/prisma/client";
import { IMapper }          from "../../../infrastructure/repository/base.repository";
import { UserEntity }       from "../domain/auth.entity";
import { UserResponseData } from "../types/auth.types";

/*
|--------------------------------------------------------------------------
| USER MAPPER
| Converts raw Prisma User model → clean domain entity
| Strips sensitive fields (passwordHash) before any response
|--------------------------------------------------------------------------
*/

export class UserMapper implements IMapper<User, UserEntity> {

    // ── DB model → Domain entity ─────────────────────────────────────────
    // Used internally in use cases
    toDomain(raw: User): UserEntity {
        return {
            id:                raw.id,
            schoolId:          raw.schoolId,
            email:             raw.email,
            role:              raw.role,
            firstName:         raw.firstName,
            lastName:          raw.lastName,
            phone:             raw.phone,
            photoUrl:          raw.photoUrl,
            isActive:          raw.isActive,
            isEmailVerified:   raw.isEmailVerified,
            emailVerifiedAt:   raw.emailVerifiedAt,
            lastLoginAt:       raw.lastLoginAt,
            lastLoginIp:       raw.lastLoginIp,
            failedLoginCount:  raw.failedLoginCount,
            lockedUntil:       raw.lockedUntil,
            passwordChangedAt: raw.passwordChangedAt,
            createdAt:         raw.createdAt,
            updatedAt:         raw.updatedAt,
        };
        // passwordHash intentionally excluded
    }

    // ── Domain entity → API response ─────────────────────────────────────
    // Used in controllers before sending to client
    toResponse(entity: UserEntity): UserResponseData {
        return {
            id:              entity.id,
            email:           entity.email,
            role:            entity.role,
            firstName:       entity.firstName,
            lastName:        entity.lastName,
            phone:           entity.phone,
            photoUrl:        entity.photoUrl,
            schoolId:        entity.schoolId,
            isEmailVerified: entity.isEmailVerified,
        };
    }
}