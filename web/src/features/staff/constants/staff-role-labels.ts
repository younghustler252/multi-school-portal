import { StaffRole } from "@/features/staff/types/staff.types";

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
	school_admin: "School Admin",
	principal: "Principal",
	teacher: "Teacher",
	bursar: "Bursar",
	other: "Other",
};