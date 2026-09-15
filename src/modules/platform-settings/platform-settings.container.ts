import { asClass }              from "awilix";
import type { AwilixContainer } from "awilix";

import { PlatformSettingsMapper } from "./mappers/platform-settings.mapper";

import { GetPlatformSettingsUseCase } from "./usecases/get-platform-settings.usecase";
import { UpdatePlatformSettingsUseCase } from "./usecases/update-platform-settings.usecase";

import { PlatformSettingsRepositoryImpl } from "./repositories/platform-settings.repository.impl";

import { PlatformSettingsController } from "./controllers/platform-settings.controller";


export const registerPlatformSettings = (
    container: AwilixContainer,
): void => {
    container.register({
        platformSettingsMapper:
            asClass(PlatformSettingsMapper).singleton(),

        platformSettingsRepository:
            asClass(PlatformSettingsRepositoryImpl).singleton(),

        getPlatformSettingsUseCase:
            asClass(GetPlatformSettingsUseCase).scoped(),

        updatePlatformSettingsUseCase:
            asClass(UpdatePlatformSettingsUseCase).scoped(),

        platformSettingsController:
            asClass(PlatformSettingsController).scoped(),
    });
};
