export interface UserDirectoryFilters {
    /** Each word must appear in the email, first name or last name (case-insensitive). */
    search?: string;
    schoolId?: string;
    isActive?: boolean;
    platformMember?: boolean;
    sort: "createdAt" | "lastLoginAt" | "email";
    order: "asc" | "desc";
    page: number;
    limit: number;
}

export interface UserDirectoryRow {
    id: string; email: string; firstName: string | null; lastName: string | null; isActive: boolean;
    lastLoginAt: Date | null; createdAt: Date; schoolCount: number;
    platformMember: { id: string; status: string; roles: { id: string; name: string }[] } | null;
}

/* Read-only listing of global accounts for the platform console. Reads the public database only (never a school's own schema). */
export interface IUserDirectoryRepository {
    list(filters: UserDirectoryFilters): Promise<{ rows: UserDirectoryRow[]; total: number }>;
}
