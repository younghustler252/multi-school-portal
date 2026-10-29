import { Request, Response, NextFunction } from "express";
import { GetSchoolSettingsUseCase }    from "../usecases/get-school-settings.usecase";
import { UpdateSchoolSettingsUseCase } from "../usecases/update-school-settings.usecase";
import { UploadStampUseCase }          from "../usecases/upload-stamp.usecase";
import { GetSchoolPreferencesUseCase, UpdateSchoolPreferencesUseCase } from "../usecases/school-preferences.usecases";
import { schoolSettingsErrors }        from "../domain/school-settings.errors";
import { sendSuccess }                 from "../../../shared/utils/api-response";
import { UnauthorizedError }           from "../../../shared/errors/domain.errors";

interface Dependencies {
    getSchoolSettingsUseCase:        GetSchoolSettingsUseCase;
    updateSchoolSettingsUseCase:     UpdateSchoolSettingsUseCase;
    uploadStampUseCase:              UploadStampUseCase;
    getSchoolPreferencesUseCase:     GetSchoolPreferencesUseCase;
    updateSchoolPreferencesUseCase:  UpdateSchoolPreferencesUseCase;
}

const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };

export class SchoolSettingsController {
    constructor(private readonly d: Dependencies) {}

    getSettings = async (_req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getSchoolSettingsUseCase.execute(), "Settings retrieved successfully"); } catch (e) { next(e); }
    };

    updateSettings = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateSchoolSettingsUseCase.execute(req.body, schoolIdOf(req), userIdOf(req)), "Settings updated successfully"); }
        catch (e) { next(e); }
    };

    uploadStamp     = (req: Request, res: Response, next: NextFunction) => this.upload("stamp", req, res, next);
    uploadSignature = (req: Request, res: Response, next: NextFunction) => this.upload("signature", req, res, next);

    private async upload(type: "stamp" | "signature", req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.file) throw schoolSettingsErrors.noFile();
            const result = await this.d.uploadStampUseCase.execute(schoolIdOf(req), userIdOf(req), type, { buffer: req.file.buffer });
            sendSuccess(res, result, `${type === "stamp" ? "Stamp" : "Signature"} uploaded successfully`);
        } catch (e) { next(e); }
    }

    getPreferences = async (_req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getSchoolPreferencesUseCase.execute(), "Preferences retrieved successfully"); } catch (e) { next(e); }
    };

    updatePreferences = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateSchoolPreferencesUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Preferences updated successfully"); }
        catch (e) { next(e); }
    };
}
