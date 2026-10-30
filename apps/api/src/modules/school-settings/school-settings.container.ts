import { asClass }                        from "awilix";
import type { AwilixContainer }           from "awilix";
import { SchoolSettingsMapper }           from "./mappers/school-settings.mapper";
import { SchoolSettingsRepositoryImpl }   from "./repositories/school-settings.repository.impl";
import { SchoolSettingValueRepositoryImpl } from "./repositories/setting-value.repository.impl";
import { SchoolPreferencesService }       from "./services/school-preferences.service";
import { GetSchoolSettingsUseCase }       from "./usecases/get-school-settings.usecase";
import { UpdateSchoolSettingsUseCase }    from "./usecases/update-school-settings.usecase";
import { UploadStampUseCase }             from "./usecases/upload-stamp.usecase";
import { GetSchoolPreferencesUseCase, UpdateSchoolPreferencesUseCase } from "./usecases/school-preferences.usecases";
import { SchoolSettingsController }       from "./controllers/school-settings.controller";

/*
| Requires: the audit module (auditService), the foundation (entitlementsService) and the shared storageService.
| `schoolPreferencesService` is what other modules ask for the school's message and automation preferences.
*/
export const registerSchoolSettings = (container: AwilixContainer): void => {
    container.register({
        schoolSettingsMapper:           asClass(SchoolSettingsMapper).singleton(),
        schoolSettingsRepository:       asClass(SchoolSettingsRepositoryImpl).scoped(),
        schoolSettingValueRepository:   asClass(SchoolSettingValueRepositoryImpl).scoped(),
        schoolPreferencesService:       asClass(SchoolPreferencesService).scoped(),

        getSchoolSettingsUseCase:       asClass(GetSchoolSettingsUseCase).scoped(),
        updateSchoolSettingsUseCase:    asClass(UpdateSchoolSettingsUseCase).scoped(),
        uploadStampUseCase:             asClass(UploadStampUseCase).scoped(),
        getSchoolPreferencesUseCase:    asClass(GetSchoolPreferencesUseCase).scoped(),
        updateSchoolPreferencesUseCase: asClass(UpdateSchoolPreferencesUseCase).scoped(),

        schoolSettingsController:       asClass(SchoolSettingsController).scoped(),
    });
};
