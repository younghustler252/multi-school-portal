import { Router, Request, Response, NextFunction } from "express";
import multer                       from "multer";
import { container }                from "../../../container";
import { SchoolSettingsController } from "../controllers/school-settings.controller";
import { validate }                 from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }             from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant }            from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission }        from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature }           from "../../../infrastructure/middleware/feature-gate.middleware";
import { AppError }                 from "../../../shared/errors/domain.errors";
import { reestablishTenantContext } from "../../../infrastructure/middleware/reestablish-tenant-context";
import { UpdateSchoolSettingsDto, UpdateSchoolPreferencesDto } from "../dtos/school-settings.dto";
import { BRANDING_IMAGE_MAX_BYTES, LETTERHEAD_IMAGE_MAX_BYTES } from "../domain/branding-image";

/*
| SCHOOL SETTINGS ROUTES (school realm, mounted at /school-settings)
|   GET  /               school_settings.view     branding, report card template (null until the school saves it once)
|   PUT  /               school_settings.manage   change them (the custom letterhead template needs the plan feature report_cards.letterhead)
|   POST /stamp          school_settings.manage   multipart field "stamp": PNG, JPEG or WebP, 2 MB at most
|   POST /signature      school_settings.manage   multipart field "signature": same rules
|   POST /letterhead     school_settings.manage + plan feature report_cards.letterhead   multipart field "letterhead": PNG, JPEG or WebP, 5 MB at most
|   GET  /preferences    school_settings.view     message and automation preferences with defaults
|   PUT  /preferences    school_settings.manage   { values: { key: value | null } }  null restores the default
| The permission check runs BEFORE the upload is read, so a person without it cannot push a file at all.
*/
const router = Router();
const ctrl = () => container.resolve<SchoolSettingsController>("schoolSettingsController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission)] as const;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: BRANDING_IMAGE_MAX_BYTES, files: 1 } });

// The letterhead may be bigger than a stamp. Oversize or a wrong field name is a clean 400 (multer's own errors would otherwise reach the client as a 500).
const letterheadMulter = multer({ storage: multer.memoryStorage(), limits: { fileSize: LETTERHEAD_IMAGE_MAX_BYTES, files: 1 } });
const letterheadUpload = (req: Request, res: Response, next: NextFunction) =>
    letterheadMulter.single("letterhead")(req, res, (err: unknown) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(`The image must be ${LETTERHEAD_IMAGE_MAX_BYTES / (1024 * 1024)} MB or smaller`, 400, true, "IMAGE_TOO_LARGE"));
            return next(new AppError('Send one file in the field "letterhead"', 400, true, "FILE_MISSING"));
        }
        next(err);
    });

router.get("/", ...guard("school_settings.view"), (q, s, n) => ctrl().getSettings(q, s, n));
router.put("/", ...guard("school_settings.manage"), validate(UpdateSchoolSettingsDto), (q, s, n) => ctrl().updateSettings(q, s, n));

router.get("/preferences", ...guard("school_settings.view"), (q, s, n) => ctrl().getPreferences(q, s, n));
router.put("/preferences", ...guard("school_settings.manage"), validate(UpdateSchoolPreferencesDto), (q, s, n) => ctrl().updatePreferences(q, s, n));

// multer leaves the tenant context behind, so it is re-established after it (same as before)
router.post("/stamp", ...guard("school_settings.manage"), upload.single("stamp"), reestablishTenantContext, (q, s, n) => ctrl().uploadStamp(q, s, n));
router.post("/signature", ...guard("school_settings.manage"), upload.single("signature"), reestablishTenantContext, (q, s, n) => ctrl().uploadSignature(q, s, n));

// Permission and plan feature are checked BEFORE the file is read, so nobody without them can push a file at all
router.post("/letterhead", ...guard("school_settings.manage"), requireFeature("report_cards.letterhead"), letterheadUpload, reestablishTenantContext, (q, s, n) => ctrl().uploadLetterhead(q, s, n));

export default router;
