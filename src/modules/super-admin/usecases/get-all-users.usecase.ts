import { IUserRepository }        from "../../auth/repositories/user.repository";
import { UserMapper }             from "../../auth/mappers/user.mapper";
import { PaginatedResult }        from "../../../infrastructure/repository/base.repository";
import { ListUsersDtoType }       from "../dtos/super-admin.dto";

interface Dependencies {
    userRepository: IUserRepository;
    userMapper:     UserMapper;
}

export class GetAllUsersUseCase {
    private readonly userRepository: IUserRepository;
    private readonly userMapper:     UserMapper;

    constructor({ userRepository, userMapper }: Dependencies) {
        this.userRepository = userRepository;
        this.userMapper     = userMapper;
    }

    async execute(dto: ListUsersDtoType): Promise<PaginatedResult<any>> {
        const where: Record<string, any> = {};

        if (dto.role) where.role = dto.role;

        if (dto.search) {
            where.OR = [
                { email:     { contains: dto.search, mode: "insensitive" } },
                { firstName: { contains: dto.search, mode: "insensitive" } },
                { lastName:  { contains: dto.search, mode: "insensitive" } },
            ];
        }

        const result = await this.userRepository.paginate({
            page:    Number(dto.page)  || 1,
            limit:   Number(dto.limit) || 20,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(u => this.userMapper.toResponse(u)),
            meta: result.meta,
        };
    }
}