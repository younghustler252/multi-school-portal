import { AwilixContainer, asFunction } from "awilix";
import { prisma, getTenantClient } from "../infrastructure/database/prisma/prisma.client";
import { AccessDb, AccessService } from "./access.service";
import { EntitlementsDb, EntitlementsService } from "./entitlements.service";

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
                meters: {
                    "students.active": () => getTenantClient().student.count({ where: { isActive: true } }),
                    "staff.active":    () => getTenantClient().staff.count({ where: { isActive: true } }),
                    "branches.active": () => getTenantClient().branch.count({ where: { isActive: true, deletedAt: null } }),
                },
            }),
        ).singleton(),
    });
};
