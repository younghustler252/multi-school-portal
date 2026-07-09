import { IStaffRepository }   from "../repositories/staff.repository";
import { IUserRepository }    from "../../auth/repositories/user.repository";
import { StaffMapper }        from "../mappers/staff.mapper";
import { StaffResponseData }  from "../mappers/staff.mapper";
import { NotFoundError }      from "../../../shared/errors/domain.errors";
import { StaffErrorMessage }  from "../domain/staff.enums";
import { UpdateStaffDtoType } from "../dtos/staff.dto";

/*
|--------------------------------------------------------------------------
| UPDATE STAFF USE CASE
| Updates both Staff record (tenant) and User record (public)
|--------------------------------------------------------------------------
*/

interface Dependencies {
    staffRepository: IStaffRepository;
    userRepository:  IUserRepository;
    staffMapper:     StaffMapper;
}

export class UpdateStaffUseCase {
    private readonly staffRepository: IStaffRepository;
    private readonly userRepository:  IUserRepository;
    private readonly staffMapper:     StaffMapper;

    constructor({
        staffRepository,
        userRepository,
        staffMapper,
    }: Dependencies) {
        this.staffRepository = staffRepository;
        this.userRepository  = userRepository;
        this.staffMapper     = staffMapper;
    }

    async execute(
        id:  string,
        dto: UpdateStaffDtoType,
    ): Promise<StaffResponseData> {

        // ── Find staff ────────────────────────────────────────────────────
        const staff = await this.staffRepository.findById(id);
        if (!staff) {
            throw new NotFoundError(StaffErrorMessage.NOT_FOUND);
        }

        // ── Update User record (name, phone) ──────────────────────────────
        const userUpdateData: Record<string, any> = {};
        if (dto.firstName) userUpdateData.firstName = dto.firstName;
        if (dto.lastName)  userUpdateData.lastName  = dto.lastName;
        if (dto.phone)     userUpdateData.phone     = dto.phone;

        if (Object.keys(userUpdateData).length > 0) {
            await this.userRepository.update(staff.userId, userUpdateData);
        }

        // ── Update Staff record ───────────────────────────────────────────
        const staffUpdateData: Record<string, any> = {};
        if (dto.role)          staffUpdateData.role          = dto.role;
        if (dto.employeeId)    staffUpdateData.employeeId    = dto.employeeId;
        if (dto.department)    staffUpdateData.department    = dto.department;
        if (dto.designation)   staffUpdateData.designation   = dto.designation;
        if (dto.qualification) staffUpdateData.qualification = dto.qualification;
        if (dto.gender)        staffUpdateData.gender        = dto.gender;
        if (dto.address)       staffUpdateData.address       = dto.address;
        if (dto.dateOfBirth)   staffUpdateData.dateOfBirth   = new Date(dto.dateOfBirth);
        if (dto.joinDate)      staffUpdateData.joinDate      = new Date(dto.joinDate);

        const updated = await this.staffRepository.update(id, staffUpdateData);

        // ── Fetch updated user for response ───────────────────────────────
        const user = await this.userRepository.findById(staff.userId);

        return this.staffMapper.toResponse({
            ...updated,
            firstName: user?.firstName ?? null,
            lastName:  user?.lastName  ?? null,
            email:     user?.email,
            phone:     user?.phone     ?? null,
            photoUrl:  user?.photoUrl  ?? null,
        });
    }
}