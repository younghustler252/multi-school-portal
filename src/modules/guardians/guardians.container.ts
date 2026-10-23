import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { GuardianMapper } from "./mappers/guardian.mapper";
import { GuardianRepositoryImpl } from "./repositories/guardian.repository.impl";
import { CreateGuardianUseCase } from "./usecases/create-guardian.usecase";
import { UpdateGuardianUseCase } from "./usecases/update-guardian.usecase";
import { LinkGuardianUseCase, UpdateGuardianLinkUseCase, UnlinkGuardianUseCase } from "./usecases/guardian-links.usecases";
import { InviteGuardianUseCase, BulkInviteGuardiansUseCase } from "./usecases/guardian-invites.usecases";
import { ListGuardiansUseCase, GetGuardianUseCase, GetMyChildrenUseCase } from "./usecases/guardian-queries.usecases";
import { GuardianController } from "./controllers/guardian.controller";

/*
| GUARDIANS CONTAINER.
| Requires: registerStudents (studentRepository, studentPhotoService), registerAudit (auditService),
|           registerAuth (sendInviteUseCase, membershipService), registerFoundation (accessService).
*/
export const registerGuardians = (container: AwilixContainer): void => {
    container.register({
        guardianMapper:             asClass(GuardianMapper).singleton(),
        guardianRepository:         asClass(GuardianRepositoryImpl).scoped(),

        listGuardiansUseCase:       asClass(ListGuardiansUseCase).scoped(),
        getGuardianUseCase:         asClass(GetGuardianUseCase).scoped(),
        getMyChildrenUseCase:       asClass(GetMyChildrenUseCase).scoped(),
        createGuardianUseCase:      asClass(CreateGuardianUseCase).scoped(),
        updateGuardianUseCase:      asClass(UpdateGuardianUseCase).scoped(),
        linkGuardianUseCase:        asClass(LinkGuardianUseCase).scoped(),
        updateGuardianLinkUseCase:  asClass(UpdateGuardianLinkUseCase).scoped(),
        unlinkGuardianUseCase:      asClass(UnlinkGuardianUseCase).scoped(),
        inviteGuardianUseCase:      asClass(InviteGuardianUseCase).scoped(),
        bulkInviteGuardiansUseCase: asClass(BulkInviteGuardiansUseCase).scoped(),

        guardianController:         asClass(GuardianController).scoped(),
    });
};
