import { Router, Request, Response, NextFunction } from "express";
import multer                  from "multer";
import { container }           from "../../../container";
import { UserController }      from "../controllers/user.controller";
import { validate }            from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }        from "../../../infrastructure/middleware/auth.middleware";
import { loadAccess, requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { validateTenantOwnership } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { reestablishTenantContext } from "../../../infrastructure/middleware/reestablish-tenant-context";
import { AppError }            from "../../../shared/errors/domain.errors";
import { UpdateProfileDto, ChangePasswordDto, ResetAdminPasswordDto } from "../dtos/user.dto";

/*
| USER ROUTES
| Order: authenticate -> loadAccess / permission -> (multer -> reestablishTenantContext) -> validate -> controller.
| loadAccess runs BEFORE multer so access loads in the original tenant context;
| reestablishTenantContext runs right after multer.
| /me/password is the one route a must-change-password session may call (auth.middleware exemption).
*/

const router = Router();
const ctrl   = () => container.resolve<UserController>("userController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Turns multer failures (too large, wrong field) into the standard error shape instead of a 500
const avatarUpload = (req: Request, res: Response, next: NextFunction) =>
    upload.single("avatar")(req, res, (err: unknown) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            const msg = err.code === "LIMIT_FILE_SIZE" ? "Image must be 2 MB or smaller" : "Upload failed";
            return next(new AppError(msg, 400, true, "INVALID_IMAGE"));
        }
        next(err);
    });

// ── Own profile ───────────────────────────────────────────────────────────
router.get("/me", authenticate, loadAccess, (q, s, n) => ctrl().getProfile(q, s, n));
router.put("/me", authenticate, loadAccess, validate(UpdateProfileDto), (q, s, n) => ctrl().updateProfile(q, s, n));

// ── Password (returns a fresh session) ────────────────────────────────────
router.put("/me/password", authenticate, validateTenantOwnership, validate(ChangePasswordDto), (q, s, n) => ctrl().changePassword(q, s, n));

// ── Avatar ────────────────────────────────────────────────────────────────
router.post("/me/avatar", authenticate, loadAccess, avatarUpload, reestablishTenantContext, (q, s, n) => ctrl().uploadAvatar(q, s, n));
router.delete("/me/avatar", authenticate, loadAccess, (q, s, n) => ctrl().removeAvatar(q, s, n));

// ── What this login can enter (profile + school switchers) ────────────────
router.get("/me/access", authenticate, loadAccess, (q, s, n) => ctrl().listMyAccess(q, s, n));

// ── Signed-in devices ─────────────────────────────────────────────────────
router.get("/me/sessions", authenticate, validateTenantOwnership, (q, s, n) => ctrl().listMySessions(q, s, n));
router.delete("/me/sessions/:id", authenticate, validateTenantOwnership, (q, s, n) => ctrl().revokeMySession(q, s, n));

// ── Platform support: reset a school administrator's password ─────────────
router.post(
    "/schools/:schoolId/admin/reset-password",
    authenticate, requirePermission("platform.users.manage"), validate(ResetAdminPasswordDto),
    (q, s, n) => ctrl().resetSchoolAdminPassword(q, s, n),
);

export default router;
