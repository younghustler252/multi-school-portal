import { IStaffRepository }   from "../repositories/staff.repository";
import { IUserRepository }    from "../../auth/repositories/user.repository";
import { StaffMapper }        from "../mappers/staff.mapper";
import { StaffResponseData }  from "../mappers/staff.mapper";
import { NotFoundError }      from "../../../shared/errors/domain.errors";
import { StaffErrorMessage }  from "../domain/staff.enums";

/*
|--------------------------------------------------------------------------
| REACTIVATE STAFF USE CASE
| Reactivates both Staff + User records
|--------------------------------------------------------------------------
*/

interface Dependencies {
    staffRepository: IStaffRepository;
    userRepository:  IUserRepository;
    staffMapper:     StaffMapper;
}

export class ReactivateStaffUseCase {
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

    async execute(id: string): Promise<StaffResponseData> {

        // ── Find staff ────────────────────────────────────────────────────
        const staff = await this.staffRepository.findById(id);
        if (!staff) {
            throw new NotFoundError(StaffErrorMessage.NOT_FOUND);
        }

        // ── Reactivate staff record ───────────────────────────────────────
        const updated = await this.staffRepository.update(id, {
            isActive: true,
        });

        // ── Reactivate user account ───────────────────────────────────────
        await this.userRepository.update(staff.userId, {
            isActive: true,
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