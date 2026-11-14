import {
	LayoutDashboard, Users, UserCog, GraduationCap, BookOpen, ClipboardCheck,
	FileText, Wallet, CreditCard, UserPlus, Settings, Building2, Layers, Bell, MessageSquareMore, Megaphone,
	type LucideIcon,
} from "lucide-react";
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
