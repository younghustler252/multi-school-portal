import { User }             from "../../../generated/prisma/client";
import { IMapper }          from "../../../infrastructure/repository/base.repository";
import { UserProfileEntity } from "../domain/user.entity";

export interface UserProfileResponseData {
    id:              string;
    email:           string;
    role:            string;
    firstName:       string | null;
    lastName:        string | null;
    phone:           string | null;
    photoUrl:        string | null;
    schoolId:        string | null;
    isEmailVerified: boolean;
    lastLoginAt:     Date | null;
    createdAt:       Date;
}

export class UserProfileMapper implements IMapper<User, UserProfileEntity> {

    toDomain(raw: User): UserProfileEntity {
        return {
            id:                raw.id,
            email:             raw.email,
            role:              raw.role,
            firstName:         raw.firstName,
            lastName:          raw.lastName,
            phone:             raw.phone,
            photoUrl:          raw.photoUrl,
            schoolId:          raw.schoolId,
            isEmailVerified:   raw.isEmailVerified,
            lastLoginAt:       raw.lastLoginAt,
            passwordChangedAt: raw.passwordChangedAt,
            createdAt:         raw.createdAt,
            updatedAt:         raw.updatedAt,
        };
    }

    toResponse(entity: UserProfileEntity): UserProfileResponseData {
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
            lastLoginAt:     entity.lastLoginAt,
            createdAt:       entity.createdAt,
        };
    }
}