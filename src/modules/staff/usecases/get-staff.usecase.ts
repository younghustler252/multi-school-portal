import { IStaffRepository }   from "../repositories/staff.repository";
import { IUserRepository }    from "../../auth/repositories/user.repository";
import { StaffMapper }        from "../mappers/staff.mapper";
import { StaffResponseData }  from "../mappers/staff.mapper";
import { NotFoundError }      from "../../../shared/errors/domain.errors";
import { StaffErrorMessage }  from "../domain/staff.enums";

/*
|--------------------------------------------------------------------------
| GET STAFF USE CASE
| Get a single staff member with user data
|--------------------------------------------------------------------------
*/

interface Dependencies {
    staffRepository: IStaffRepository;
    userRepository:  IUserRepository;
    staffMapper:     StaffMapper;
}

export class GetStaffUseCase {
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
        const staff = await this.staffRepository.findById(id);

        if (!staff) {
            throw new NotFoundError(StaffErrorMessage.NOT_FOUND);
        }

        // Enrich with user data from public schema
        const user = await this.userRepository.findById(staff.userId);

        const enriched = {
            ...staff,
            firstName: user?.firstName ?? null,
            lastName:  user?.lastName  ?? null,
            email:     user?.email,
            phone:     user?.phone     ?? null,
            photoUrl:  user?.photoUrl  ?? null,
        };

        return this.staffMapper.toResponse(enriched);
    }
}