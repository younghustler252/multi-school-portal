import { IStaffRepository }   from "../repositories/staff.repository";
import { IUserRepository }    from "../../auth/repositories/user.repository";
import { StaffMapper }        from "../mappers/staff.mapper";
import { StaffResponseData }  from "../mappers/staff.mapper";
import { AuditService }       from "../../audit/services/audit.service";
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
    auditService:    AuditService;
}

export class ReactivateStaffUseCase {
    private readonly staffRepository: IStaffRepository;
    private readonly userRepository:  IUserRepository;
    private readonly staffMapper:     StaffMapper;
    private readonly auditService:    AuditService;

    constructor({
        staffRepository,
        userRepository,
        staffMapper,
        auditService,
    }: Dependencies) {
        this.staffRepository = staffRepository;
        this.userRepository  = userRepository;
        this.staffMapper     = staffMapper;
        this.auditService    = auditService;
    }

    async execute(
        id:               string,
        requestingUserId: string,
    ): Promise<StaffResponseData> {

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

        // ── Audit staff reactivation ──────────────────────────────────────
        await this.auditService.log({
            userId:   requestingUserId,
            action:   "staff.reactivated",
            entity:   "Staff",
            entityId: staff.id,
            oldValue: {
                staffId:  staff.id,
                userId:   staff.userId,
                isActive: staff.isActive,
            },
            newValue: {
                staffId:  updated.id,
                userId:   staff.userId,
                isActive: updated.isActive,
            },
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
