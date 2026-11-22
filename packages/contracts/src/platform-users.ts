import { z } from "zod";

/*
| GET /users (platform console, permission platform.users.view): every global user account, paginated. Read-only.
|
| Three different things, kept apart:
|   user account       the person's login (email, name, active flag). One per person, shared by all their schools.
|   school link        which schools the account belongs to (only a COUNT here, or filter with ?schoolId=). A person's role inside a
|                      school lives in that school and is not listed here.
|   platform operator  staff of the platform itself (platformMember, with its platform roles). Independent of any school.
| There are no `role` or `schoolId` fields on a user; do not look for them.
|
| Reads (GET /users and GET /users/:id, the safe summary) need platform.users.view.
| Writes stay on platform.users.manage: POST /users/:id/deactivate, POST /users/:id/reactivate, POST /users/schools/:schoolId/admin/reset-password.
| Errors: 400 invalid query, 401, 403 (no platform.users.view, or a school session).
| Full contract: docs/api/contract-additions/platform-users.md
*/
const flag = z.enum(["true", "false"]).transform(v => v === "true");
export const ListPlatformUsersQuery = z.object({
    page:           z.coerce.number().int().min(1).default(1),
    limit:          z.coerce.number().int().min(1).max(100).default(20),
    /** Each word must appear in the email, first name or last name. */
    search:         z.string().trim().max(100).optional(),
    /** Only accounts that belong to this school. */
    schoolId:       z.string().trim().min(1).max(64).optional(),
    isActive:       flag.optional(),
    /** true = only platform operators, false = only ordinary accounts. */
    platformMember: flag.optional(),
    sort:           z.enum(["createdAt", "lastLoginAt", "email"]).default("createdAt"),
    /** Default: asc for email, desc otherwise. */
    order:          z.enum(["asc", "desc"]).optional(),
});
export type ListPlatformUsersQuery = z.input<typeof ListPlatformUsersQuery>;

export interface PlatformUserListItem {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isActive: boolean;
    /** ISO timestamp, null if never signed in. */
    lastLoginAt: string | null;
    createdAt: string;
    /** How many schools the account belongs to. */
    schoolCount: number;
    /** null for an ordinary account. */
    platformMember: { id: string; status: string; roles: { id: string; name: string }[] } | null;
}

export interface PlatformUserListMeta { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean }
export interface PlatformUserList { data: PlatformUserListItem[]; meta: PlatformUserListMeta }
