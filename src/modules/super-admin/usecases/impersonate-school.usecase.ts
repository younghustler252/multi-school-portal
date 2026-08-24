import { ISchoolRepository }  from "../../school/repositories/school.repository";
import { IUserRepository }    from "../../auth/repositories/user.repository";
import { TokenService }       from "../../../shared/services/token.service";
import { NotFoundError }      from "../../../shared/errors/domain.errors";
import { Role } from "../../../generated/public";

/*
|--------------------------------------------------------------------------
| IMPERSONATE SCHOOL USE CASE
| Super admin gets a temporary token scoped to a school admin
| Used for support — lets super admin see exactly what school admin sees
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository: ISchoolRepository;
    userRepository:   IUserRepository;
    tokenService:     TokenService;
}

export class ImpersonateSchoolUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly userRepository:   IUserRepository;
    private readonly tokenService:     TokenService;

    constructor({
        schoolRepository,
        userRepository,
        tokenService,
    }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.userRepository   = userRepository;
        this.tokenService     = tokenService;
    }

    async execute(schoolId: string): Promise<{
        accessToken: string;
        school:      any;
        admin:       any;
    }> {
        // ── Find school ───────────────────────────────────────────────────
        const school = await this.schoolRepository.findById(schoolId);
        if (!school) throw new NotFoundError("School");

        // ── Find school admin ─────────────────────────────────────────────
        const admin = await this.userRepository.findOne({
            schoolId,
            role: Role.school_admin,
        });

        if (!admin) throw new NotFoundError("School admin not found");

        // ── Generate short-lived impersonation token ───────────────────────
        const accessToken = this.tokenService.generateAccessToken({
            id:       admin.id,
            email:    admin.email,
            role:     admin.role,
            schoolId: admin.schoolId,
            mustChangePassword: admin.mustChangePassword
        });

        return { accessToken, school, admin };
    }
}