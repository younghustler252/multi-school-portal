import { asClass }                        from "awilix";
import type { AwilixContainer }           from "awilix";
import { SchoolSettingsMapper }           from "./mappers/school-settings.mapper";
import { SchoolSettingsRepositoryImpl }   from "./repositories/school-settings.repository.impl";
import { GetSchoolSettingsUseCase }       from "./usecases/get-school-settings.usecase";
import { UpdateSchoolSettingsUseCase }    from "./usecases/update-school-settings.usecase";
import { UploadStampUseCase }            from "./usecases/upload-stamp.usecase";
import { SchoolSettingsController }       from "./controllers/school-settings.controller";

export const registerSchoolSettings = (container: AwilixContainer): void => {
    container.register({
        schoolSettingsMapper:        asClass(SchoolSettingsMapper).singleton(),
        schoolSettingsRepository:    asClass(SchoolSettingsRepositoryImpl).scoped(),
        getSchoolSettingsUseCase:    asClass(GetSchoolSettingsUseCase).scoped(),
        updateSchoolSettingsUseCase: asClass(UpdateSchoolSettingsUseCase).scoped(),
        uploadStampUseCase:          asClass(UploadStampUseCase).scoped(),
        schoolSettingsController:    asClass(SchoolSettingsController).scoped(),
    });
};