import type { EmploymentType, PortalStatus, StaffCategory } from "../types/staff.types";

export const STAFF_CATEGORY_LABELS: Record<StaffCategory, string> = { teaching: "Teaching", non_teaching: "Non-teaching" };

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
	full_time: "Full-time", part_time: "Part-time", contract: "Contract", volunteer: "Volunteer",
};

export const PORTAL_STATUS_LABELS: Record<PortalStatus, string> = {
	none: "No portal access", invited: "Invited", active: "Portal active", suspended: "Portal suspended",
};
