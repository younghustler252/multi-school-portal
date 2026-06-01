// utils/tenantResolver.ts
import School, { ISchoolDocument } from "../../infrastructure/database/models/school.model";

export const resolveTenantFromHost = async (
    host: string
): Promise<ISchoolDocument | null> => {
    const subdomain = host.split(".")[0];

    // main / public domains
    if (subdomain === "www" || subdomain === "portal") {
        return null;
    }

    // Look up school by slug
    const school = await School.findOne({ slug: subdomain });

    return school;
};
