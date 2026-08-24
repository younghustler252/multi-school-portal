export interface PlatformStats {
	schools: { total: number; active: number; pending: number; suspended: number };
	users: { total: number; admins: number; teachers: number; guardians: number };
	subscriptions: { total: number; active: number; trialing: number; expired: number };
	revenue: { totalKobo: number };
}

export interface PlatformUserResponseData {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
	schoolId: string | null;
	isActive: boolean;
	createdAt: string;
}

export interface ListUsersParams {
	page?: number;
	limit?: number;
	role?: string;
	search?: string;
}

export interface PlanDistributionEntry {
	planId: string;
	planName: string;
	schoolCount: number;
}

export interface PlatformStats {
	schools: { total: number; active: number; pending: number; suspended: number };
	users: { total: number; admins: number; teachers: number; guardians: number };
	students: { total: number };
	subscriptions: { total: number; active: number; trialing: number; expired: number };
	revenue: { totalKobo: number };
	conversionRate: number;
	plans: PlanDistributionEntry[];
}

export interface MrrTrendEntry {
	month: string;
	mrrKobo: number;
}

export interface PlatformUserResponseData {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
	schoolId: string | null;
	isActive: boolean;
	createdAt: string;
}

export interface ListUsersParams {
	page?: number;
	limit?: number;
	role?: string;
	search?: string;
}