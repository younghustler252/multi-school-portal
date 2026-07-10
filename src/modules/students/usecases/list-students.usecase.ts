import { IStudentRepository }  from "../repositories/student.repository";
import { StudentMapper }       from "../mappers/student.mapper";
import { StudentResponseData } from "../mappers/student.mapper";
import { PaginatedResult }     from "../../../infrastructure/repository/base.repository";
import { ListStudentsDtoType } from "../dtos/student.dto";
import { parsePagination }     from "../../../shared/utils/pagination";

/*
|--------------------------------------------------------------------------
| LIST STUDENTS USE CASE
|--------------------------------------------------------------------------
*/

interface Dependencies {
    studentRepository: IStudentRepository;
    studentMapper:     StudentMapper;
}

export class ListStudentsUseCase {
    private readonly studentRepository: IStudentRepository;
    private readonly studentMapper:     StudentMapper;

    constructor({ studentRepository, studentMapper }: Dependencies) {
        this.studentRepository = studentRepository;
        this.studentMapper     = studentMapper;
    }

    async execute(
        dto: ListStudentsDtoType,
    ): Promise<PaginatedResult<StudentResponseData>> {

        // ── Search query ──────────────────────────────────────────────────
        if (dto.search) {
            const { page, limit } = parsePagination({
                page:  Number(dto.page),
                limit: Number(dto.limit),
            });

            const result = await this.studentRepository.searchStudents(
                dto.search,
                { page, limit },
            );

            return {
                data: result.data.map(s =>
                    this.studentMapper.toResponse(s),
                ),
                meta: result.meta,
            };
        }

        // ── Standard filter ───────────────────────────────────────────────
        const where: Record<string, any> = {};

        if (dto.gender)   where.gender   = dto.gender;
        if (dto.isActive !== undefined) {
            where.isActive = dto.isActive === "true";
        }

        const result = await this.studentRepository.paginate({
            page:    Number(dto.page)  || 1,
            limit:   Number(dto.limit) || 20,
            where,
            orderBy: { createdAt: "desc" },
        });

        return {
            data: result.data.map(s => this.studentMapper.toResponse(s)),
            meta: result.meta,
        };
    }
}