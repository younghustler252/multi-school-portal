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
	super_admin: "/dashboard",
	school_admin: "/school-admin/dashboard",
	principal: "/principal/overview",
	teacher: "/teacher/dashboard",
	bursar: "/bursar/fees",
	student: "/student/grades",
	guardian: "/guardian/children",
};