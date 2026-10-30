import axios, { AxiosInstance } from "axios";
import {
    IDocumentVerificationProvider,
    VerifyDocumentParams,
    VerifyDocumentResult,
} from "../interfaces/verification.provider.interface";
import { env } from "../../../config/env";

/*
|--------------------------------------------------------------------------
| QOREID PROVIDER
| Government ID verification (NIN, Voter's Card, Driver's License, Passport)
| Docs: https://docs.qoreid.com
|
| Auth flow: QoreID uses client credentials to obtain a short-lived bearer
| token, then that token authorizes lookup calls. Token is cached and
| refreshed only when expired, to avoid re-authenticating on every request.
|--------------------------------------------------------------------------
*/

const ID_TYPE_ENDPOINT_MAP: Record<string, string> = {
    nin:                     "nin",
    voters_card:             "vin",
    drivers_license:         "drivers-license",
    international_passport:  "passport",
};

interface CachedToken {
    accessToken: string;
    expiresAt:   number; // epoch ms
}

export class QoreIdProvider implements IDocumentVerificationProvider {
    private readonly http: AxiosInstance;
    private tokenCache: CachedToken | null = null;

    constructor() {
        this.http = axios.create({
            baseURL: env.qoreId.baseUrl, // sandbox: https://api.qoreid.com, adjust per env
        });
    }

    async verifyGovernmentId(params: VerifyDocumentParams): Promise<VerifyDocumentResult> {
        const endpointSlug = ID_TYPE_ENDPOINT_MAP[params.idType];

        if (!endpointSlug) {
            return {
                verified:    false,
                rawResponse: { error: `Unsupported ID type for automated verification: ${params.idType}` },
            };
        }

        const token = await this.getAccessToken();

        const [firstName, ...rest] = params.fullName.trim().split(/\s+/);
        const lastName = rest.join(" ") || firstName;

        // NOTE: confirm this exact path/body shape against QoreID's live docs —
        // inferred from their voter's-card example; other ID types may differ
        // slightly (e.g. NIN might expect { nin: ... } in the URL only, no body
        // validations key). Adjust here if the sandbox response looks off.
        const { data } = await this.http.post(
            `/v1/ng/identities/${endpointSlug}/${params.idNumber}`,
            {
                validations: {
                    data: {
                        firstName,
                        lastName,
                    },
                },
            },
            {
                headers: { Authorization: `Bearer ${token}` },
            },
        );

        const fieldMatches = data?.summary?.[`${endpointSlug}_check`]?.fieldMatches
            ?? data?.summary?.match?.fieldMatches
            ?? {};

        const status = data?.summary?.[`${endpointSlug}_check`]?.status
            ?? data?.status?.status;

        const verified = status === "EXACT_MATCH"
            || (fieldMatches.firstName === true && fieldMatches.lastName === true);

        const matchedName = data?.applicant
            ? `${data.applicant.firstname ?? ""} ${data.applicant.lastname ?? ""}`.trim()
            : undefined;

        return {
            verified,
            matchedName,
            rawResponse: data,
        };
    }

    private async getAccessToken(): Promise<string> {
        if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
            return this.tokenCache.accessToken;
        }

        // NOTE: confirm QoreID's actual token endpoint path/body — this follows
        // the common client_id/secret → bearer-token pattern most Nigerian
        // KYC providers use, but verify against your sandbox credentials setup.
        const { data } = await this.http.post("/v1/token", {
            clientId: env.qoreId.clientId,
            secret:   env.qoreId.secret,
        });

        this.tokenCache = {
            accessToken: data.accessToken,
            expiresAt:   Date.now() + (data.expiresIn ?? 3300) * 1000, // default ~55min if not provided
        };

        return this.tokenCache.accessToken;
    }
}