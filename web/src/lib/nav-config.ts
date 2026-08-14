import {
	LayoutDashboard,
	Users,
	UserCog,
	GraduationCap,
	BookOpen,
	ClipboardCheck,
	FileText,
	Wallet,
	CreditCard,
	Bell,
	UserPlus,
	Settings,
	Building2,
	Layers,
	type LucideIcon,
} from "lucide-react";
import { Role } from "@/types/roles";

export interface NavItem {
	label: string;
	to: string;
	icon: LucideIcon;
}

// Mirrors PROJECT_BRIEF.md section 3 — Role → Module access.
// Each role only sees nav items for modules it actually has access to.

export const NAV_CONFIG: Record<Role, NavItem[]> = {

	school_admin: [
		{ label: "Dashboard", to: "/school-admin/dashboard", icon: LayoutDashboard },
		{ label: "Staff", to: "/school-admin/staff", icon: UserCog },
		{ label: "Students", to: "/school-admin/students", icon: GraduationCap },
		{ label: "Guardians", to: "/school-admin/guardians", icon: UserPlus },
		{ label: "Classes", to: "/school-admin/classes", icon: Layers },
		{ label: "Enrolment", to: "/school-admin/enrolment", icon: BookOpen },
		{ label: "Attendance", to: "/school-admin/attendance", icon: ClipboardCheck },
		{ label: "Grades", to: "/school-admin/grades", icon: FileText },
		{ label: "Report Cards", to: "/school-admin/report-cards", icon: FileText },
		{ label: "Fees", to: "/school-admin/fees", icon: Wallet },
		{ label: "Payments", to: "/school-admin/payments", icon: CreditCard },
		{ label: "Settings", to: "/school-admin/settings", icon: Settings },
	],

	teacher: [
		{label: "Dashboard", to: "/teacher/dashboard", icon: LayoutDashboard },
		{ label: "My Classes", to: "/teacher/my-classes", icon: Layers },
		{ label: "Attendance", to: "/teacher/attendance", icon: ClipboardCheck },
		{ label: "Grades", to: "/teacher/grades", icon: FileText },
	],

	bursar: [
		{ label: "Fees", to: "/bursar/fees", icon: Wallet },
		{ label: "Payments", to: "/bursar/payments", icon: CreditCard },
	],

	principal: [
		{ label: "Overview", to: "/principal/overview", icon: LayoutDashboard },
		{ label: "Students", to: "/principal/students", icon: GraduationCap },
		{ label: "Attendance", to: "/principal/attendance", icon: ClipboardCheck },
		{ label: "Grades", to: "/principal/grades", icon: FileText },
	],

	student: [
		{ label: "Grades", to: "/student/grades", icon: FileText },
		{ label: "Attendance", to: "/student/attendance", icon: ClipboardCheck },
		{ label: "Report Cards", to: "/student/report-cards", icon: FileText },
	],

	guardian: [
		{ label: "My Children", to: "/guardian/children", icon: Users },
		{ label: "Fees", to: "/guardian/fees", icon: Wallet },
		{ label: "Payments", to: "/guardian/payments", icon: CreditCard },
	],

	super_admin: [
		{ label: "Schools", to: "/schools", icon: Building2 },
		{ label: "Plans", to: "/plans", icon: Layers },
		{ label: "Subscriptions", to: "/subscriptions", icon: CreditCard },
	],

};

export const ROLE_META: Record<Role, { label: string; description: string }> = {
	school_admin: { label: "School Admin", description: "Full school management access" },
	teacher: { label: "Teacher", description: "Manage your classes and grades" },
	bursar: { label: "Bursar", description: "Manage fees and payments" },
	principal: { label: "Principal", description: "School-wide visibility" },
	student: { label: "Student", description: "View your own records" },
	guardian: { label: "Guardian", description: "View your child's records" },
	super_admin: { label: "Super Admin", description: "Platform-wide access" },
};