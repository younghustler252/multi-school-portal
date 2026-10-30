import { Request, Response, NextFunction } from "express";
import { GetPlatformSettingsUseCase } from "../usecases/get-platform-settings.usecase";
import {UpdatePlatformSettingsUseCase } from "../usecases/update-platform-settings.usecase"
import { sendSuccess } from "../../../shared/utils/api-response";

interface Dependencies {
    getPlatformSettingsUseCase:    GetPlatformSettingsUseCase;
    updatePlatformSettingsUseCase: UpdatePlatformSettingsUseCase;
}

export class PlatformSettingsController {
    private readonly getPlatformSettingsUseCase:    GetPlatformSettingsUseCase;
    private readonly updatePlatformSettingsUseCase: UpdatePlatformSettingsUseCase;

    constructor({
        getPlatformSettingsUseCase,
        updatePlatformSettingsUseCase,
    }: Dependencies) {
        this.getPlatformSettingsUseCase    = getPlatformSettingsUseCase;
        this.updatePlatformSettingsUseCase = updatePlatformSettingsUseCase;
    }

    // ── Get Platform Settings ─────────────────────────────────────────────

    getSettings = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getPlatformSettingsUseCase.execute();

            sendSuccess(
                res,
                result,
                "Platform settings retrieved successfully",
            );
        } catch (err) {
            next(err);
        }
    };

    // ── Update Platform Settings ──────────────────────────────────────────

    updateSettings = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updatePlatformSettingsUseCase.execute(
                req.body,
            );

            sendSuccess(
                res,
                result,
                "Platform settings updated successfully",
            );
        } catch (err) {
            next(err);
        }
    };
}
