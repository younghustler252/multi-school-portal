import { Request, Response, NextFunction }  from "express";
import { GetSchoolSettingsUseCase }         from "../usecases/get-school-settings.usecase";
import { UpdateSchoolSettingsUseCase }      from "../usecases/update-school-settings.usecase";
import { UploadStampUseCase }              from "../usecases/upload-stamp.usecase";
import { sendSuccess }                     from "../../../shared/utils/api-response";

interface Dependencies {
    getSchoolSettingsUseCase:    GetSchoolSettingsUseCase;
    updateSchoolSettingsUseCase: UpdateSchoolSettingsUseCase;
    uploadStampUseCase:          UploadStampUseCase;
}

export class SchoolSettingsController {
    private readonly getSchoolSettingsUseCase:    GetSchoolSettingsUseCase;
    private readonly updateSchoolSettingsUseCase: UpdateSchoolSettingsUseCase;
    private readonly uploadStampUseCase:          UploadStampUseCase;

    constructor({
        getSchoolSettingsUseCase,
        updateSchoolSettingsUseCase,
        uploadStampUseCase,
    }: Dependencies) {
        this.getSchoolSettingsUseCase    = getSchoolSettingsUseCase;
        this.updateSchoolSettingsUseCase = updateSchoolSettingsUseCase;
        this.uploadStampUseCase          = uploadStampUseCase;
    }

    // ── Get settings ──────────────────────────────────────────────────────
    getSettings = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getSchoolSettingsUseCase.execute();
            sendSuccess(res, result, "Settings retrieved successfully");
        } catch (err) { next(err); }
    };

    // ── Update settings ───────────────────────────────────────────────────
    updateSettings = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateSchoolSettingsUseCase.execute(
                req.body,
            );
            sendSuccess(res, result, "Settings updated successfully");
        } catch (err) { next(err); }
    };

    // ── Upload stamp ──────────────────────────────────────────────────────
    uploadStamp = async (
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

            const result = await this.uploadStampUseCase.execute(
                req.user!.schoolId!,
                "stamp",
                {
                    buffer:   file.buffer,
                    mimetype: file.mimetype,
                    filename: file.originalname,
                },
            );
            sendSuccess(res, result, "Stamp uploaded successfully");
        } catch (err) { next(err); }
    };

    // ── Upload signature ──────────────────────────────────────────────────
    uploadSignature = async (
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

            const result = await this.uploadStampUseCase.execute(
                req.user!.schoolId!,
                "signature",
                {
                    buffer:   file.buffer,
                    mimetype: file.mimetype,
                    filename: file.originalname,
                },
            );
            sendSuccess(res, result, "Signature uploaded successfully");
        } catch (err) { next(err); }
    };
}