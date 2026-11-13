import { Request, Response, NextFunction } from "express";
import { GetPlatformSettingsUseCase } from "../usecases/get-platform-settings.usecase";
import {UpdatePlatformSettingsUseCase } from "../usecases/update-platform-settings.usecase"
import { UploadPlatformLogoUseCase, RemovePlatformLogoUseCase } from "../usecases/platform-logo.usecases";
import { sendSuccess } from "../../../shared/utils/api-response";
import { AppError } from "../../../shared/errors/domain.errors";

interface Dependencies {
    getPlatformSettingsUseCase:    GetPlatformSettingsUseCase;
    updatePlatformSettingsUseCase: UpdatePlatformSettingsUseCase;
    uploadPlatformLogoUseCase:     UploadPlatformLogoUseCase;
    removePlatformLogoUseCase:     RemovePlatformLogoUseCase;
}

export class PlatformSettingsController {
    private readonly getPlatformSettingsUseCase:    GetPlatformSettingsUseCase;
    private readonly updatePlatformSettingsUseCase: UpdatePlatformSettingsUseCase;
    private readonly uploadPlatformLogoUseCase:     UploadPlatformLogoUseCase;
    private readonly removePlatformLogoUseCase:     RemovePlatformLogoUseCase;

    constructor({
        getPlatformSettingsUseCase,
        updatePlatformSettingsUseCase,
        uploadPlatformLogoUseCase,
        removePlatformLogoUseCase,
    }: Dependencies) {
        this.uploadPlatformLogoUseCase     = uploadPlatformLogoUseCase;
        this.removePlatformLogoUseCase     = removePlatformLogoUseCase;
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

    //  Upload / clear the logo

    uploadLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.file) throw new AppError("No file uploaded", 400, true, "INVALID_IMAGE");
            const result = await this.uploadPlatformLogoUseCase.execute(req.auth!.userId, { buffer: req.file.buffer });
            sendSuccess(res, result, "Logo uploaded successfully");
        } catch (err) {
            next(err);
        }
    };

    removeLogo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result = await this.removePlatformLogoUseCase.execute(req.auth!.userId);
            sendSuccess(res, result, "Logo removed successfully");
        } catch (err) {
            next(err);
        }
    };
}
