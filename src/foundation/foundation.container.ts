import { AwilixContainer, asFunction } from "awilix";
import { prisma, getTenantClient } from "../infrastructure/database/prisma/prisma.client";
import { AccessDb, AccessService } from "./access.service";
import { EntitlementsDb, EntitlementsService } from "./entitlements.service";
import { ACTIVE_STUDENT_WHERE } from "../modules/students/domain/student-eligibility";

/*
|--------------------------------------------------------------------------
| FOUNDATION CONTAINER
| Registers the cross-cutting platform services used by the middlewares:
|   accessService       who is this session and what may they do   (rbac.middleware)
|   entitlementsService what does this school's plan allow         (feature-gate.middleware)
|
| Both are SINGLETONS on purpose: each keeps a short-lived in-memory cache
| that must be shared by every request. They take (db, options) rather than
| a dependencies object, so they are registered with asFunction, not asClass.
|--------------------------------------------------------------------------
*/

type Cradle = { prismaClient: typeof prisma };

/** meterKey -> how much the school is using right now (runs inside the request's tenant context). Exported so tests call the real thing. */
export const tenantMeters = () => ({
    "students.active": () => getTenantClient().student.count({ where: ACTIVE_STUDENT_WHERE }),
    "staff.active":    () => getTenantClient().staff.count({ where: { isActive: true } }),
    "branches.active": () => getTenantClient().branch.count({ where: { isActive: true, deletedAt: null } }),
});

export const registerFoundation = (container: AwilixContainer): void => {
    container.register({

        accessService: asFunction(({ prismaClient }: Cradle) =>
            new AccessService({
                tenant:   () => getTenantClient() as unknown as ReturnType<AccessDb["tenant"]>,
                platform: prismaClient as unknown as AccessDb["platform"],
            }),
        ).singleton(),

        entitlementsService: asFunction(({ prismaClient }: Cradle) =>
            new EntitlementsService(prismaClient as unknown as EntitlementsDb, {
                // meterKey -> how much the school is using right now (runs inside the request's tenant context)
                meters: tenantMeters(),
            }),
        ).singleton(),
    });
};
