import { IStaffRepository } from "../../staff/repositories/staff.repository";
import { classErrors } from "../domain/class.errors";

/** A teacher for a subject must be an ACTIVE staff member in the TEACHING category. Unknown staff is "not found". */
export async function requireTeachingStaff(staffRepository: IStaffRepository, staffId: string, invalid: () => Error) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) throw classErrors.staffNotFound();
    if (!staff.isActive || staff.category !== "teaching") throw invalid();
    return staff;
}
