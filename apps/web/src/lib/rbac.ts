import { Role } from "@/types/roles";

export type AccessLevel =
    | "full"       // ✅ full CRUD
    | "view"       // view only
    | "own"        // scoped to own records (student, own classes, etc.)
    | "own_child"  // guardian scoped to linked child
    | "none";      // ❌ no access

export type Module =
    | "super-admin"
    | "plans"
    | "subscriptions"
    | "school"
    | "staff"
    | "students"
    | "enrolment"
    | "classes"
    | "attendance"
    | "grades"
    | "report-cards"
    | "fees"
    | "payments"
    | "notifications"
    | "guardians";

// Mirrors PROJECT_BRIEF.md section 3 table exactly
export const RBAC_MATRIX: Record<Module, Record<Role, AccessLevel>> = {
    "super-admin":  { super_admin: "full", school_admin: "none", principal: "none", teacher: "none", bursar: "none", student: "none", guardian: "none" },
    "plans":        { super_admin: "full", school_admin: "none", principal: "none", teacher: "none", bursar: "none", student: "none", guardian: "none" },
    "subscriptions":{ super_admin: "full", school_admin: "view", principal: "none", teacher: "none", bursar: "none", student: "none", guardian: "none" },
    "school":       { super_admin: "full", school_admin: "full", principal: "none", teacher: "none", bursar: "none", student: "none", guardian: "none" },
    "staff":        { super_admin: "full", school_admin: "full", principal: "none", teacher: "none", bursar: "none", student: "none", guardian: "none" },
    "students":     { super_admin: "full", school_admin: "full", principal: "view", teacher: "view", bursar: "none", student: "own", guardian: "none" },
    "enrolment":    { super_admin: "full", school_admin: "full", principal: "none", teacher: "none", bursar: "none", student: "none", guardian: "none" },
    "classes":      { super_admin: "full", school_admin: "full", principal: "none", teacher: "own", bursar: "none", student: "none", guardian: "none" },
    "attendance":   { super_admin: "full", school_admin: "full", principal: "none", teacher: "own", bursar: "none", student: "own", guardian: "none" },
    "grades":       { super_admin: "full", school_admin: "full", principal: "none", teacher: "own", bursar: "none", student: "own", guardian: "own_child" },
    "report-cards": { super_admin: "full", school_admin: "full", principal: "none", teacher: "none", bursar: "none", student: "own", guardian: "own_child" },
    "fees":         { super_admin: "full", school_admin: "full", principal: "none", teacher: "none", bursar: "full", student: "own", guardian: "own_child" },
    "payments":     { super_admin: "full", school_admin: "full", principal: "none", teacher: "none", bursar: "full", student: "none", guardian: "own_child" },
    "notifications":{ super_admin: "full", school_admin: "full", principal: "none", teacher: "none", bursar: "none", student: "none", guardian: "none" },
    "guardians":    { super_admin: "full", school_admin: "full", principal: "none", teacher: "none", bursar: "none", student: "none", guardian: "own" },
};

export function getAccessLevel(module: Module, role: Role): AccessLevel {
    return RBAC_MATRIX[module]?.[role] ?? "none";
}

export function hasAccess(module: Module, role: Role): boolean {
    return getAccessLevel(module, role) !== "none";
}

export function canEdit(module: Module, role: Role): boolean {
    const level = getAccessLevel(module, role);
    return level === "full";
}