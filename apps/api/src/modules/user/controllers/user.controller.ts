import { Request, Response, NextFunction } from "express";
import { GetProfileUseCase }            from "../usecases/get-profile.usecase";
import { UpdateProfileUseCase }         from "../usecases/update-profile.usecase";
import { ChangePasswordUseCase }        from "../usecases/change-password.usecase";
import { UploadAvatarUseCase }          from "../usecases/upload-avatar.usecase";
import { RemoveAvatarUseCase }          from "../usecases/remove-avatar.usecase";
import { ListMyAccessUseCase }          from "../usecases/list-my-access.usecase";
import { ManageMySessionsUseCase }      from "../usecases/manage-my-sessions.usecase";
import { ResetSchoolAdminPasswordUseCase } from "../usecases/reset-school-admin-password.usecase";
import { sendSuccess }                  from "../../../shared/utils/api-response";
import { setAuthCookies, clearAuthCookies } from "../../../infrastructure/middleware/auth.middleware";
import { getAccess }                    from "../../../infrastructure/middleware/rbac.middleware";
import { userErrors }                   from "../domain/user.errors";
import { UserActionContext }            from "../domain/user.types";

interface Dependencies {
    getProfileUseCase:      GetProfileUseCase;
    updateProfileUseCase:   UpdateProfileUseCase;
    changePasswordUseCase:  ChangePasswordUseCase;
    uploadAvatarUseCase:    UploadAvatarUseCase;
    removeAvatarUseCase:    RemoveAvatarUseCase;
    listMyAccessUseCase:    ListMyAccessUseCase;
    manageMySessionsUseCase: ManageMySessionsUseCase;
    resetSchoolAdminPasswordUseCase: ResetSchoolAdminPasswordUseCase;
}

/*
| USER CONTROLLER. Identity always comes from req.auth (the verified token), never from the body or URL.
*/

const ctxOf = (req: Request): UserActionContext => {
    const a = req.auth;
    if (!a) throw userErrors.notFound();
    return {
        userId:         a.userId,
        schoolId:       a.schoolId,
        membershipId:   a.membershipId,
        impersonatedBy: a.impersonatedBy,
        ip:             req.ip ?? req.socket.remoteAddress ?? "unknown",
        userAgent:      req.get("user-agent") ?? null,
    };
};

// Persona of the current session (loadAccess ran earlier on these routes)
const personaOf = (req: Request): string | null => getAccess(req).persona ?? null;

const refreshTokenOf = (req: Request): string | undefined => req.cookies?.refreshToken ?? req.body?.refreshToken;

export class UserController {
    constructor(private readonly d: Dependencies) {}

    getProfile = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getProfileUseCase.execute(ctxOf(req), personaOf(req)), "Profile retrieved successfully"); }
        catch (e) { next(e); }
    };

    updateProfile = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateProfileUseCase.execute(ctxOf(req), personaOf(req), req.body), "Profile updated successfully"); }
        catch (e) { next(e); }
    };

    // Returns a fresh session (cookies replaced); other devices are signed out
    changePassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.d.changePasswordUseCase.execute(ctxOf(req), req.body);
            setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
            sendSuccess(res, result, "Password changed successfully");
        } catch (e) { next(e); }
    };

    uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const file = req.file;
            if (!file) throw userErrors.invalidImage("No file uploaded");
            const result = await this.d.uploadAvatarUseCase.execute(ctxOf(req), personaOf(req), {
                buffer: file.buffer, mimetype: file.mimetype, filename: file.originalname,
            });
            sendSuccess(res, result, "Avatar uploaded successfully");
        } catch (e) { next(e); }
    };

    removeAvatar = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.removeAvatarUseCase.execute(ctxOf(req), personaOf(req)), "Avatar removed"); }
        catch (e) { next(e); }
    };

    listMyAccess = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listMyAccessUseCase.execute(ctxOf(req)), "Access retrieved successfully"); }
        catch (e) { next(e); }
    };

    listMySessions = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.manageMySessionsUseCase.list(ctxOf(req), refreshTokenOf(req)), "Sessions retrieved successfully"); }
        catch (e) { next(e); }
    };

    revokeMySession = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.manageMySessionsUseCase.revoke(ctxOf(req), String(req.params.id), refreshTokenOf(req));
            if (r.wasCurrent) clearAuthCookies(res);
            sendSuccess(res, { signedOut: r.wasCurrent }, "Session signed out");
        } catch (e) { next(e); }
    };

    resetSchoolAdminPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.resetSchoolAdminPasswordUseCase.execute(String(req.params.schoolId), req.body, ctxOf(req));
            sendSuccess(res, null, r.message);
        } catch (e) { next(e); }
    };
}
