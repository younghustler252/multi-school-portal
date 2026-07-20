import { asClass }                  from "awilix";
import type { AwilixContainer }     from "awilix";
import { UserProfileMapper }        from "./mappers/user.mapper";
import { GetProfileUseCase }        from "./usecases/get-profile.usecase";
import { UpdateProfileUseCase }     from "./usecases/update-profile.usecase";
import { ChangePasswordUseCase }    from "./usecases/change-password.usecase";
import { UploadAvatarUseCase }      from "./usecases/upload-avatar.usecase";
import { UserController }           from "./controllers/user.controller";

export const registerUser = (container: AwilixContainer): void => {
    container.register({
        userProfileMapper:     asClass(UserProfileMapper).singleton(),
        getProfileUseCase:     asClass(GetProfileUseCase).scoped(),
        updateProfileUseCase:  asClass(UpdateProfileUseCase).scoped(),
        changePasswordUseCase: asClass(ChangePasswordUseCase).scoped(),
        uploadAvatarUseCase:   asClass(UploadAvatarUseCase).scoped(),
        userController:        asClass(UserController).scoped(),
    });
};