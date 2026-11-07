import {
	LayoutDashboard, Users, UserCog, GraduationCap, BookOpen, ClipboardCheck,
	FileText, Wallet, CreditCard, UserPlus, Settings, Building2, Layers, Bell, MessageSquareMore, Megaphone,
	type LucideIcon,
} from "lucide-react";
import { Role } from "@/types/roles";
import type { NavIcon } from "@/lib/nav-model";

/** Icon for each entry in lib/nav-model.ts. */
export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
	dashboard: LayoutDashboard,
	staff: UserCog,
	students: GraduationCap,
	guardians: UserPlus,
	classes: Layers,
	subjects: BookOpen,
	attendance: ClipboardCheck,
	grades: FileText,
	reportCards: FileText,
	fees: Wallet,
	payments: CreditCard,
	notifications: Bell,
	announcements: Megaphone,
	settings: Settings,
	schools: Building2,
	users: Users,
	plans: Layers,
	subscriptions: CreditCard,
	feedback: MessageSquareMore,
};

// Legacy: only the settings "roles" tab still reads this. Navigation no longer uses role names.
export const ROLE_META: Record<Role, { label: string; description: string }> = {
	school_admin: { label: "School Admin", description: "Full school management access" },
	teacher: { label: "Teacher", description: "Manage your classes and grades" },
	bursar: { label: "Bursar", description: "Manage fees and payments" },
	principal: { label: "Principal", description: "School-wide visibility" },
	student: { label: "Student", description: "View your own records" },
	guardian: { label: "Guardian", description: "View your child's records" },
	super_admin: { label: "Super Admin", description: "Platform-wide access" },
};

