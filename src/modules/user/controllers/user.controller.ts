import { Request, Response, NextFunction } from "express";
import { GetProfileUseCase }    from "../usecases/get-profile.usecase";
import { UpdateProfileUseCase } from "../usecases/update-profile.usecase";
import { ChangePasswordUseCase } from "../usecases/change-password.usecase";
import { UploadAvatarUseCase }  from "../usecases/upload-avatar.usecase";
import { sendSuccess }          from "../../../shared/utils/api-response";
import {
    clearAuthCookies,
}                               from "../../../infrastructure/middleware/auth.middleware";

interface Dependencies {
    getProfileUseCase:     GetProfileUseCase;
    updateProfileUseCase:  UpdateProfileUseCase;
    changePasswordUseCase: ChangePasswordUseCase;
    uploadAvatarUseCase:   UploadAvatarUseCase;
}

export class UserController {
    private readonly getProfileUseCase:     GetProfileUseCase;
    private readonly updateProfileUseCase:  UpdateProfileUseCase;
    private readonly changePasswordUseCase: ChangePasswordUseCase;
    private readonly uploadAvatarUseCase:   UploadAvatarUseCase;

    constructor({
        getProfileUseCase,
        updateProfileUseCase,
        changePasswordUseCase,
        uploadAvatarUseCase,
    }: Dependencies) {
        this.getProfileUseCase     = getProfileUseCase;
        this.updateProfileUseCase  = updateProfileUseCase;
        this.changePasswordUseCase = changePasswordUseCase;
        this.uploadAvatarUseCase   = uploadAvatarUseCase;
    }

    // ── Get own profile ───────────────────────────────────────────────────
    getProfile = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getProfileUseCase.execute(req.user!.id);
            sendSuccess(res, result, "Profile retrieved successfully");
        } catch (err) { next(err); }
    };

    // ── Update own profile ────────────────────────────────────────────────
    updateProfile = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateProfileUseCase.execute(
                req.user!.id,
                req.body,
            );
            sendSuccess(res, result, "Profile updated successfully");
        } catch (err) { next(err); }
    };

    // ── Change password ───────────────────────────────────────────────────
    changePassword = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.changePasswordUseCase.execute(
                req.user!.id,
                req.body,
            );

            // Clear cookies — user must re-login
            clearAuthCookies(res);

            sendSuccess(res, null, result.message);
        } catch (err) { next(err); }
    };

    // ── Upload avatar ─────────────────────────────────────────────────────
    uploadAvatar = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const file = req.file;
            if (!file) {
                res.status(400).json({
                    success: false,
                    message: "No file uploaded",
                });
                return;
            }

            const result = await this.uploadAvatarUseCase.execute(
                req.user!.id,
                {
                    buffer:   file.buffer,
                    mimetype: file.mimetype,
                    filename: file.originalname,
                },
            );
            sendSuccess(res, result, "Avatar uploaded successfully");
        } catch (err) { next(err); }
    };
}