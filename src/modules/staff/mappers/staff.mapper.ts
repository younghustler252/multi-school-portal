import { IMapper } from "../../../infrastructure/repository/base.repository";
import { StaffEntity } from "../domain/staff.entity";

/*
|--------------------------------------------------------------------------
| STAFF MAPPER
| Raw DB result → domain entity
| Staff table has no sensitive fields but we join User data
|--------------------------------------------------------------------------
*/

export interface StaffResponseData {
    id:            string;
    userId:        string;
    employeeId:    string | null;
    firstName:     string | null;
    lastName:      string | null;
    email:         string | undefined;
    phone:         string | null;
    photoUrl:      string | null;
    role:          string;
    department:    string | null;
    designation:   string | null;
    qualification: string | null;
    gender:        string | null;
    dateOfBirth:   Date | null;
    address:       string | null;
    joinDate:      Date | null;
    isActive:      boolean;
    createdAt:     Date;
}

export class StaffMapper implements IMapper<any, StaffEntity> {

    toDomain(raw: any): StaffEntity {
        return {
            id:            raw.id,
            userId:        raw.userId,
            employeeId:    raw.employeeId,
            department:    raw.department,
            designation:   raw.designation,
            qualification: raw.qualification,
            gender:        raw.gender,
            dateOfBirth:   raw.dateOfBirth,
            address:       raw.address,
            joinDate:      raw.joinDate,
            role:          raw.role,
            isActive:      raw.isActive,
            createdAt:     raw.createdAt,
            updatedAt:     raw.updatedAt,
            // Joined user fields
            firstName:     raw.user?.firstName ?? null,
            lastName:      raw.user?.lastName  ?? null,
            email:         raw.user?.email,
            phone:         raw.user?.phone     ?? null,
            photoUrl:      raw.user?.photoUrl  ?? null,
        };
    }

    toResponse(entity: StaffEntity): StaffResponseData {
        return {
            id:            entity.id,
            userId:        entity.userId,
            employeeId:    entity.employeeId,
            firstName:     entity.firstName    ?? null,
            lastName:      entity.lastName     ?? null,
            email:         entity.email,
            phone:         entity.phone        ?? null,
            photoUrl:      entity.photoUrl     ?? null,
            role:          entity.role,
            department:    entity.department,
            designation:   entity.designation,
            qualification: entity.qualification,
            gender:        entity.gender,
            dateOfBirth:   entity.dateOfBirth,
            address:       entity.address,
            joinDate:      entity.joinDate,
            isActive:      entity.isActive,
            createdAt:     entity.createdAt,
        };
    }
}