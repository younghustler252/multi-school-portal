import { Router }             from "express";
import multer                 from "multer";
import { container }          from "../../../container";
import { UserController }     from "../controllers/user.controller";
import { validate }           from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }       from "../../../infrastructure/middleware/auth.middleware";
import {
    UpdateProfileDto,
    ChangePasswordDto,
}                             from "../dtos/user.dto";

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 2 * 1024 * 1024 }, // 2MB
});

const ctrl = () => container.resolve<UserController>("userController");

// ── Get own profile ───────────────────────────────────────────────────────
router.get(
    "/me",
    authenticate,
    (req, res, next) => ctrl().getProfile(req, res, next),
);

// ── Update own profile ────────────────────────────────────────────────────
router.put(
    "/me",
    authenticate,
    validate(UpdateProfileDto),
    (req, res, next) => ctrl().updateProfile(req, res, next),
);

// ── Change password ───────────────────────────────────────────────────────
router.put(
    "/me/password",
    authenticate,
    validate(ChangePasswordDto),
    (req, res, next) => ctrl().changePassword(req, res, next),
);

// ── Upload avatar ─────────────────────────────────────────────────────────
router.post(
    "/me/avatar",
    authenticate,
    upload.single("avatar"),
    (req, res, next) => ctrl().uploadAvatar(req, res, next),
);

export default router;