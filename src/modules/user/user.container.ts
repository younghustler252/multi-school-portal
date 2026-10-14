import { asClass }              from "awilix";
import type { AwilixContainer } from "awilix";
import { UserProfileMapper }    from "./mappers/user.mapper";
import { GetProfileUseCase }    from "./usecases/get-profile.usecase";
import { UpdateProfileUseCase } from "./usecases/update-profile.usecase";
import { ChangePasswordUseCase } from "./usecases/change-password.usecase";
import { UploadAvatarUseCase }  from "./usecases/upload-avatar.usecase";
import { RemoveAvatarUseCase }  from "./usecases/remove-avatar.usecase";
import { ListMyAccessUseCase }  from "./usecases/list-my-access.usecase";
import { ManageMySessionsUseCase } from "./usecases/manage-my-sessions.usecase";
import { ResetSchoolAdminPasswordUseCase } from "./usecases/reset-school-admin-password.usecase";
import { UserController }       from "./controllers/user.controller";

/*
| Requires the auth module to be registered first (repositories and services it exports) and
| storageService from registerShared.
*/
export const registerUser = (container: AwilixContainer): void => {
    container.register({
        userProfileMapper:        asClass(UserProfileMapper).singleton(),
        getProfileUseCase:        asClass(GetProfileUseCase).scoped(),
        updateProfileUseCase:     asClass(UpdateProfileUseCase).scoped(),
        changePasswordUseCase:    asClass(ChangePasswordUseCase).scoped(),
        uploadAvatarUseCase:      asClass(UploadAvatarUseCase).scoped(),
        removeAvatarUseCase:      asClass(RemoveAvatarUseCase).scoped(),
        listMyAccessUseCase:      asClass(ListMyAccessUseCase).scoped(),
        manageMySessionsUseCase:  asClass(ManageMySessionsUseCase).scoped(),
        resetSchoolAdminPasswordUseCase: asClass(ResetSchoolAdminPasswordUseCase).scoped(),
        userController:           asClass(UserController).scoped(),
    });
};
