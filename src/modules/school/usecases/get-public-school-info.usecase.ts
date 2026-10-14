import { ISchoolRepository } from "../repositories/school.repository";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { TenantContext } from "../../../infrastructure/database/prisma/tenant.context";
import { schoolErrors } from "../domain/school.errors";
import { schoolState, SchoolState } from "../domain/school.policy";

interface Dependencies { schoolRepository: ISchoolRepository }

// Safe to show to anyone (login screen): no verification details, no internals
export interface PublicSchoolInfo {
    name:           string;
    subdomain:      string;
    logoUrl:        string | null;
    schoolCategory: string;
    state:          SchoolState;   // active | setting_up | suspended | unavailable
    primaryColor:   string;
    secondaryColor: string | null;
    motto:          string | null;
    website:        string | null;
    address:        string | null;
}

const DEFAULT_PRIMARY = "#1a1a2e";

export class GetPublicSchoolInfoUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(subdomain: string): Promise<PublicSchoolInfo> {
        const school = await this.d.schoolRepository.findBySubdomain(subdomain.trim().toLowerCase());
        if (!school) throw schoolErrors.notFound();

        const state = schoolState(school);
        let settings: { primaryColor: string | null; secondaryColor: string | null; motto: string | null } | null = null;

        // Branding colours and motto live in the school's own schema, which exists only once it is built
        if (state === "active" && school.schemaName) {
            try {
                settings = await TenantContext.run(
                    { tenantSchema: school.schemaName, schoolId: school.id },
                    async () => getTenantClient().schoolSettings.findFirst({ select: { primaryColor: true, secondaryColor: true, motto: true } }),
                );
            } catch { /* settings are optional: fall back to defaults */ }
        }

        return {
            name: school.name, subdomain: school.subdomain, logoUrl: school.logoUrl,
            schoolCategory: school.schoolCategory, state,
            primaryColor: settings?.primaryColor ?? DEFAULT_PRIMARY, secondaryColor: settings?.secondaryColor ?? null,
            motto: settings?.motto ?? null,
            website: school.website, address: school.address,       // the School row is the one source for these
        };
    }
}
