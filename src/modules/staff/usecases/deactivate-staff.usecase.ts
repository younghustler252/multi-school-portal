import { IStaffRepository }   from "../repositories/staff.repository";
import { IUserRepository }    from "../../auth/repositories/user.repository";
import { StaffMapper }        from "../mappers/staff.mapper";
import { StaffResponseData }  from "../mappers/staff.mapper";
import {
    NotFoundError,
    BadRequestError,
}                             from "../../../shared/errors/domain.errors";
import { StaffErrorMessage }  from "../domain/staff.enums";

/*
|--------------------------------------------------------------------------
| DEACTIVATE STAFF USE CASE
| Deactivates both Staff + User records
| School admin cannot deactivate themselves
|--------------------------------------------------------------------------
*/

interface Dependencies {
    staffRepository: IStaffRepository;
    userRepository:  IUserRepository;
    staffMapper:     StaffMapper;
}

export class DeactivateStaffUseCase {
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
        id:            string,
        requestingUserId: string,
    ): Promise<StaffResponseData> {

        // ── Find staff ────────────────────────────────────────────────────
        const staff = await this.staffRepository.findById(id);
        if (!staff) {
            throw new NotFoundError(StaffErrorMessage.NOT_FOUND);
        }

        // ── Cannot deactivate self ────────────────────────────────────────
        if (staff.userId === requestingUserId) {
            throw new BadRequestError(StaffErrorMessage.CANNOT_DELETE_SELF);
        }

        // ── Deactivate staff record ───────────────────────────────────────
        const updated = await this.staffRepository.update(id, {
            isActive: false,
        });

        // ── Deactivate user account ───────────────────────────────────────
        await this.userRepository.update(staff.userId, {
            isActive: false,
        });

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