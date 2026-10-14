import { env } from "../../config/env";

/*
|--------------------------------------------------------------------------
| URL SERVICE
| The ONLY place that builds links to the platform and to schools.
| A school link uses its verified custom domain if present, otherwise
| <subdomain>.<BASE_DOMAIN>. Requires env.BASE_DOMAIN (see AUTH_MODULE_NOTES).
|--------------------------------------------------------------------------
*/

export interface SchoolUrlSource {
    subdomain:               string;
    customDomain?:           string | null;
    customDomainVerifiedAt?: Date | null;
}

export class UrlService {

    private scheme(): string {
        return env.NODE_ENV === "production" ? "https" : "http";
    }

    private port(): string {
        // Local development only (for example the frontend dev server port)
        return env.PUBLIC_URL_PORT ? `:${env.PUBLIC_URL_PORT}` : "";
    }

    private join(host: string, path: string): string {
        const clean = path ? (path.startsWith("/") ? path : `/${path}`) : "";
        return `${this.scheme()}://${host}${this.port()}${clean}`;
    }

    schoolHost(school: SchoolUrlSource): string {
        return school.customDomain && school.customDomainVerifiedAt
            ? school.customDomain
            : `${school.subdomain}.${env.BASE_DOMAIN}`;
    }

    schoolUrl(school: SchoolUrlSource, path = ""): string {
        return this.join(this.schoolHost(school), path);
    }

    platformUrl(path = ""): string {
        return this.join(env.BASE_DOMAIN, path);
    }

    adminUrl(path = ""): string {
        return this.join(`${env.ADMIN_SUBDOMAIN}.${env.BASE_DOMAIN}`, path);
    }
}
