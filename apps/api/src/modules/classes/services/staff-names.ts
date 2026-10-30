import { IStaffRepository } from "../../staff/repositories/staff.repository";
import { IUserRepository } from "../../auth/repositories/user.repository";

/*
| STAFF NAMES. Staff names live in the login table (public schema), so a name needs the staff record and its login.
| This does it for a whole page in TWO queries (not two per row) and returns { id, name } objects, so responses
| show who a person is instead of a bare id.
*/
export interface StaffRef { id: string; name: string }

export class StaffNameLookup {
    constructor(private readonly d: { staffRepository: IStaffRepository; userRepository: IUserRepository }) {}

    async byIds(ids: Array<string | null | undefined>): Promise<Map<string, StaffRef>> {
        const unique = [...new Set(ids.filter((i): i is string => !!i))];
        const out = new Map<string, StaffRef>();
        if (unique.length === 0) return out;
        const staff = await this.d.staffRepository.findMany({ id: { in: unique } });
        const userIds = staff.map(s => s.userId).filter((x): x is string => !!x);
        const users = userIds.length ? await this.d.userRepository.findByIds(userIds) : [];
        const userById = new Map(users.map(u => [u.id, u]));
        for (const s of staff) {
            const u = s.userId ? userById.get(s.userId) : undefined;
            out.set(s.id, { id: s.id, name: u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Unnamed" : "Unknown" });
        }
        return out;
    }

    /** One person, or null when there is none. */
    async one(id: string | null | undefined): Promise<StaffRef | null> {
        return id ? (await this.byIds([id])).get(id) ?? null : null;
    }
}
