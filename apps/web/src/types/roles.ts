import { ROUTES } from "@/lib/routes";

// Mirrors backend: section 3 of PROJECT_BRIEF.md — role → module access matrix

export type Role =
  | "super_admin"
  | "school_admin"
  | "principal"
  | "teacher"
  | "bursar"
  | "student"
  | "guardian";

export const ROLES: Record<Role, Role> = {
    super_admin: "super_admin",
    school_admin: "school_admin",
    principal: "principal",
    teacher: "teacher",
    bursar: "bursar",
    student: "student",
    guardian: "guardian",
};

export const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
	super_admin: ROUTES.platform.dashboard,
	school_admin: ROUTES.school.dashboard,
	principal: ROUTES.insights.overview,
	teacher: ROUTES.teaching.dashboard,
	bursar: ROUTES.finance.fees,
	student: ROUTES.learning.grades,
	guardian: ROUTES.family.children.list,
};