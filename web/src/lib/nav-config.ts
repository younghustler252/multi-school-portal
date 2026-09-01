import {
	LayoutDashboard, Users, UserCog, GraduationCap, BookOpen, ClipboardCheck,
	FileText, Wallet, CreditCard, UserPlus, Settings, Building2, Layers, ShieldCheck, Bell,
	type LucideIcon,
} from "lucide-react";
import { Role } from "@/types/roles";

export interface NavItem {
	label: string;
	to: string;
	icon: LucideIcon;
}

export const NAV_CONFIG: Record<Role, NavItem[]> = {

	school_admin: [
		{ label: "Dashboard", to: "/school-admin/dashboard", icon: LayoutDashboard },
		{ label: "Staff", to: "/school-admin/staff", icon: UserCog },
		{ label: "Students", to: "/school-admin/students", icon: GraduationCap },
		{ label: "Guardians", to: "/school-admin/guardians", icon: UserPlus },
		{ label: "Classes", to: "/school-admin/classes", icon: Layers },
		{ label: "Subjects", to: "/school-admin/subjects", icon: BookOpen },
		{ label: "Attendance", to: "/school-admin/attendance", icon: ClipboardCheck },
		{ label: "Grades", to: "/school-admin/grades", icon: FileText },
		{ label: "Report Cards", to: "/school-admin/report-cards", icon: FileText },
		{ label: "Fees", to: "/school-admin/fees", icon: Wallet },
		{ label: "Payments", to: "/school-admin/payments", icon: CreditCard },
		{ label: "Notifications", to: "/school-admin/notifications", icon: Bell },
		{ label: "Settings", to: "/school-admin/settings", icon: Settings },
	],

	teacher: [
		{ label: "Dashboard", to: "/teacher/dashboard", icon: LayoutDashboard },
		{ label: "My Classes", to: "/teacher/my-classes", icon: Layers },
		{ label: "Attendance", to: "/teacher/attendance", icon: ClipboardCheck },
		{ label: "Grades", to: "/teacher/grades", icon: FileText },
		{ label: "Notifications", to: "/teacher/notifications", icon: Bell },
	],

	bursar: [
		{ label: "Dashboard", to: "/bursar/dashboard", icon: LayoutDashboard },
		{ label: "Fees", to: "/bursar/fees", icon: Wallet },
		{ label: "Payments", to: "/bursar/payments", icon: CreditCard },
		{ label: "Notifications", to: "/bursar/notifications", icon: Bell },
	],

	principal: [
		{ label: "Overview", to: "/principal/overview", icon: LayoutDashboard },
		{ label: "Students", to: "/principal/students", icon: GraduationCap },
		{ label: "Attendance", to: "/principal/attendance", icon: ClipboardCheck },
		{ label: "Grades", to: "/principal/grades", icon: FileText },
		{ label: "Notifications", to: "/principal/notifications", icon: Bell },
	],

	student: [
		{ label: "Dashboard", to: "/student/dashboard", icon: LayoutDashboard },
		{ label: "Grades", to: "/student/grades", icon: FileText },
		{ label: "Attendance", to: "/student/attendance", icon: ClipboardCheck },
		{ label: "Report Cards", to: "/student/report-cards", icon: FileText },
		{ label: "Notifications", to: "/student/notifications", icon: Bell },
	],

	guardian: [
		{ label: "My Children", to: "/guardian/children", icon: Users },
		{ label: "Fees", to: "/guardian/fees", icon: Wallet },
		{ label: "Payments", to: "/guardian/payments", icon: CreditCard },
		{ label: "Notifications", to: "/guardian/notifications", icon: Bell },
	],

	super_admin: [
		{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
		{ label: "Schools", to: "/schools", icon: Building2 },
		{ label: "Users", to: "/users", icon: Users },
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

