import { IMapper }        from "../../../infrastructure/repository/base.repository";
import { StudentEntity }  from "../domain/student.entity";
/*
|--------------------------------------------------------------------------
| STUDENT MAPPER
|--------------------------------------------------------------------------
*/



export interface StudentResponseData {
    id:              string;
    userId:          string | null;
    admissionNumber: string | null;
    firstName:       string;
    lastName:        string;
    middleName:      string | null;
    dateOfBirth:     Date | null;
    gender:          string | null;
    bloodGroup:      string | null;
    address:         string | null;
    photoUrl:        string | null;
    religion:        string | null;
    nationality:     string | null;
    stateOfOrigin:   string | null;
    isActive:        boolean;
    admittedAt:      Date | null;
    createdAt:       Date;
}

export class StudentMapper implements IMapper<any, StudentEntity> {

    toDomain(raw: any): StudentEntity {
        return {
            id:              raw.id,
            userId:          raw.userId          ?? null,
            admissionNumber: raw.admissionNumber ?? null,
            firstName:       raw.firstName,
            lastName:        raw.lastName,
            middleName:      raw.middleName      ?? null,
            dateOfBirth:     raw.dateOfBirth     ?? null,
            gender:          raw.gender          ?? null,
            bloodGroup:      raw.bloodGroup      ?? null,
            address:         raw.address         ?? null,
            photoUrl:        raw.photoUrl        ?? null,
            religion:        raw.religion        ?? null,
            nationality:     raw.nationality     ?? null,
            stateOfOrigin:   raw.stateOfOrigin   ?? null,
            isActive:        raw.isActive,
            admittedAt:      raw.admittedAt      ?? null,
            createdAt:       raw.createdAt,
            updatedAt:       raw.updatedAt,
        };
    }

    toResponse(entity: StudentEntity): StudentResponseData {
        return {
            id:              entity.id,
            userId:          entity.userId,
            admissionNumber: entity.admissionNumber,
            firstName:       entity.firstName,
            lastName:        entity.lastName,
            middleName:      entity.middleName,
            dateOfBirth:     entity.dateOfBirth,
            gender:          entity.gender,
            bloodGroup:      entity.bloodGroup,
            address:         entity.address,
            photoUrl:        entity.photoUrl,
            religion:        entity.religion,
            nationality:     entity.nationality,
            stateOfOrigin:   entity.stateOfOrigin,
            isActive:        entity.isActive,
            admittedAt:      entity.admittedAt,
            createdAt:       entity.createdAt,
        };
    }
}