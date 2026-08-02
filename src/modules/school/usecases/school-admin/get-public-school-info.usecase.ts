import { ISchoolRepository }       from "../../repositories/school.repository";
import { getTenantClient }         from "../../../../infrastructure/database/prisma/prisma.client";
import { TenantContext }           from "../../../../infrastructure/database/prisma/tenant.context";
import { NotFoundError }           from "../../../../shared/errors/domain.errors";
import { SchoolStatusFields } from "../../types/school-status.types";

interface Dependencies {
    schoolRepository: ISchoolRepository;
}

export interface PublicSchoolInfo extends SchoolStatusFields {
    logoUrl:        string | null;
    schoolCategory: string;

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

        const school = await this.schoolRepository.findBySubdomain(
            subdomain.toLowerCase(),
        );

        if (!school) {
            throw new NotFoundError("School not found");
        }

        let settings: any = null;

        if (school.schemaName) {
            try {
                settings = await TenantContext.run(
                    {
                        tenantSchema: school.schemaName,
                        schoolId:     school.id,
                    },
                    async () => {
                        const tenantDb = getTenantClient();
                        return tenantDb.schoolSettings.findFirst();
                    },
                );
            } catch {
                // Schema may not be provisioned yet, or settings row doesn't exist — use defaults
            }
        }

        return {
            id:                 school.id,
            name:               school.name,
            subdomain:          school.subdomain,
            logoUrl:            school.logoUrl,
            status:             school.status,
            isActive:           school.isActive,
            verificationStatus: school.verificationStatus,
            schoolCategory:     school.schoolCategory,

            primaryColor:   settings?.primaryColor   ?? "#1a1a2e",
            secondaryColor: settings?.secondaryColor ?? null,
            motto:          settings?.motto          ?? null,
            website:        settings?.website        ?? null,
            principalName:  settings?.principalName  ?? null,
            address:        settings?.address        ?? null,
        };
    }
}