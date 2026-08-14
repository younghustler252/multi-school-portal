import { asClass }                   from "awilix";
import type { AwilixContainer }      from "awilix";
import { GuardianMapper }            from "./mappers/guardian.mapper";
import { GuardianRepositoryImpl }    from "./repositories/guardian.repository.impl";
import { CreateGuardianUseCase }     from "./usecases/create-guardian.usecase";
import { GetGuardianUseCase }        from "./usecases/get-guardian.usecase";
import { ListGuardiansUseCase }      from "./usecases/list-guardians.usecase";
import { UpdateGuardianUseCase }     from "./usecases/update-guardian.usecase";
import { InviteGuardianUseCase }     from "./usecases/invite-guardian.usecase";
import { LinkGuardianUseCase }       from "./usecases/link-guardian.usecase";
import { BulkInviteGuardiansUseCase } from "./usecases/bulk-invite-guardian.usecase";
import { GuardianController }        from "./controllers/guardian.controller";

/*
|--------------------------------------------------------------------------
| GUARDIANS CONTAINER
|--------------------------------------------------------------------------
*/

export const registerGuardians = (container: AwilixContainer): void => {
    container.register({
        guardianMapper:          asClass(GuardianMapper).singleton(),
        guardianRepository:      asClass(GuardianRepositoryImpl).scoped(),
        createGuardianUseCase:   asClass(CreateGuardianUseCase).scoped(),
        getGuardianUseCase:      asClass(GetGuardianUseCase).scoped(),
        listGuardiansUseCase:    asClass(ListGuardiansUseCase).scoped(),
        updateGuardianUseCase:   asClass(UpdateGuardianUseCase).scoped(),
        inviteGuardianUseCase:   asClass(InviteGuardianUseCase).scoped(),
        linkGuardianUseCase:     asClass(LinkGuardianUseCase).scoped(),
        bulkInviteGuardiansUseCase: asClass(BulkInviteGuardiansUseCase).scoped(),
        guardianController:      asClass(GuardianController).scoped(),
    });
};