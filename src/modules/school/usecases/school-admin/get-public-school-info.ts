import { ISchoolRepository }       from "../../repositories/school.repository";
import { getTenantClient }         from "../../../../infrastructure/database/prisma/prisma.client";
import { TenantContext }           from "../../../../infrastructure/database/prisma/tenant.context";
import { NotFoundError }           from "../../../../shared/errors/domain.errors";

/*
|--------------------------------------------------------------------------
| GET PUBLIC SCHOOL INFO USE CASE
| Called before login — no auth required
| Returns only safe public branding data
| Frontend uses this to brand the login page per school
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository: ISchoolRepository;
}

export interface PublicSchoolInfo {
    id:            string;
    name:          string;
    subdomain:     string;
    logoUrl:       string | null;
    status:        string;
    isActive:      boolean;
    schoolCategory: string;

    // From school settings (tenant schema)
    primaryColor:   string | null;
    secondaryColor: string | null;
    motto:          string | null;
    website:        string | null;
    principalName:  string | null;
    address:        string | null;
}

export class GetPublicSchoolInfoUseCase {
    private readonly schoolRepository: ISchoolRepository;

    constructor({ schoolRepository }: Dependencies) {
        this.schoolRepository = schoolRepository;
    }

    async execute(subdomain: string): Promise<PublicSchoolInfo> {

        // ── Find school by subdomain ───────────────────────────────────────
        const school = await this.schoolRepository.findBySubdomain(
            subdomain.toLowerCase(),
        );

        if (!school || !school.isActive) {
            throw new NotFoundError("School not found");
        }

        // ── Get school settings from tenant schema ────────────────────────
        let settings: any = null;

        if (school.schemaName) {
            try {
                const db = await TenantContext.run(
                    {
                        tenantSchema: school.schemaName,
                        schoolId:     school.id,
                    },
                    async () => {
                        const tenantDb = getTenantClient();
                        return tenantDb.schoolSettings.findFirst();
                    },
                );
                settings = db;
            } catch {
                // Settings not found — use defaults
            }
        }

        return {
            id:             school.id,
            name:           school.name,
            subdomain:      school.subdomain,
            logoUrl:        school.logoUrl,
            status:         school.status,
            isActive:       school.isActive,
            schoolCategory: school.schoolCategory,

            // Settings — safe public fields only
            primaryColor:   settings?.primaryColor   ?? "#1a1a2e",
            secondaryColor: settings?.secondaryColor ?? null,
            motto:          settings?.motto          ?? null,
            website:        settings?.website        ?? null,
            principalName:  settings?.principalName  ?? null,
            address:        settings?.address        ?? null,
        };
    }
}