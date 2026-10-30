import { IMapper } from "../../../infrastructure/repository/base.repository";
import { StaffEntity, StaffBranchRef } from "../domain/staff.entity";

export type PortalStatus = "none" | "invited" | "active" | "suspended";

export interface StaffResponseData {
    id: string; employeeId: string | null;
    firstName: string; lastName: string; middleName: string | null; fullName: string;
    email: string | null; phone: string | null; photoUrl: string | null;
    gender: string | null; dateOfBirth: Date | null; address: string | null;
    department: string | null; designation: string | null; qualification: string | null;
    category: string; employmentType: string; joinDate: Date | null; exitDate: Date | null; exitReason: string | null;
    isActive: boolean; branches: StaffBranchRef[];
    portal: { status: PortalStatus; roles: { id: string; name: string }[] };
    createdAt: Date;
}

export class StaffMapper implements IMapper<any, StaffEntity> {

    // `raw` may carry branches: [{ isPrimary, branch: { id, name, code } }] when the query included them
    toDomain(raw: any): StaffEntity {
        const branches: StaffBranchRef[] | undefined = raw.branches?.map((sb: any) => ({
            id: sb.branch.id, name: sb.branch.name, code: sb.branch.code, isPrimary: sb.isPrimary,
        }));
        return {
            id: raw.id, userId: raw.userId, employeeId: raw.employeeId, firstName: raw.firstName, lastName: raw.lastName,
            middleName: raw.middleName, email: raw.email, phone: raw.phone, photoUrl: raw.photoUrl, gender: raw.gender,
            dateOfBirth: raw.dateOfBirth, address: raw.address, department: raw.department, designation: raw.designation,
            qualification: raw.qualification, category: raw.category, employmentType: raw.employmentType, joinDate: raw.joinDate,
            exitDate: raw.exitDate, exitReason: raw.exitReason, isActive: raw.isActive, deletedAt: raw.deletedAt,
            createdAt: raw.createdAt, updatedAt: raw.updatedAt, ...(branches ? { branches } : {}),
        };
    }

    toResponse(e: StaffEntity, portal: StaffResponseData["portal"] = { status: "none", roles: [] }): StaffResponseData {
        return {
            id: e.id, employeeId: e.employeeId, firstName: e.firstName, lastName: e.lastName, middleName: e.middleName,
            fullName: [e.firstName, e.middleName, e.lastName].filter(Boolean).join(" "),
            email: e.email, phone: e.phone, photoUrl: e.photoUrl, gender: e.gender, dateOfBirth: e.dateOfBirth, address: e.address,
            department: e.department, designation: e.designation, qualification: e.qualification, category: e.category,
            employmentType: e.employmentType, joinDate: e.joinDate, exitDate: e.exitDate, exitReason: e.exitReason,
            isActive: e.isActive, branches: e.branches ?? [], portal, createdAt: e.createdAt,
        };
    }
}
