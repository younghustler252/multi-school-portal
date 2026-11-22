import { IUserDirectoryRepository } from "../repositories/user-directory.repository";
import { ListPlatformUsersQueryType } from "../dtos/user.dto";

/*
| GET /users (platform realm, platform.users.view): every global account, with how many schools it belongs to and whether it is a
| platform operator. Three different things, kept apart on purpose:
|   user account      public User: the person's login (email, name, active flag). One per person.
|   school link       public UserSchool: which schools the account belongs to (a count here; a school's own members are read in that school).
|   platform operator public PlatformMember and its roles: staff of the platform itself.
| A person's role INSIDE a school lives in that school's own schema and is deliberately not listed here, and the old single
| role / schoolId columns are gone and not brought back.
*/
export interface PlatformUserListItem {
    id: string; email: string; firstName: string | null; lastName: string | null; isActive: boolean;
    lastLoginAt: Date | null; createdAt: Date; schoolCount: number;
    platformMember: { id: string; status: string; roles: { id: string; name: string }[] } | null;
}

export class ListPlatformUsersUseCase {
    constructor(private readonly d: { userDirectoryRepository: IUserDirectoryRepository }) {}

    async execute(q: ListPlatformUsersQueryType) {
        const order = q.order ?? (q.sort === "email" ? "asc" : "desc");
        const { rows, total } = await this.d.userDirectoryRepository.list({
            search: q.search || undefined, schoolId: q.schoolId, isActive: q.isActive, platformMember: q.platformMember,
            sort: q.sort, order, page: q.page, limit: q.limit,
        });
        const totalPages = Math.max(1, Math.ceil(total / q.limit));
        return {
            data: rows as PlatformUserListItem[],
            meta: { total, page: q.page, limit: q.limit, totalPages, hasNext: q.page < totalPages, hasPrev: q.page > 1 },
        };
    }
}
