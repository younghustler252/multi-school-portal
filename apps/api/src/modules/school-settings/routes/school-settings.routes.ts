import { Router }                   from "express";
import multer                       from "multer";
import { container }                from "../../../container";
import { SchoolSettingsController } from "../controllers/school-settings.controller";
import { validate }                 from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }             from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant }            from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission }        from "../../../infrastructure/middleware/rbac.middleware";
import { reestablishTenantContext } from "../../../infrastructure/middleware/reestablish-tenant-context";
import { UpdateSchoolSettingsDto, UpdateSchoolPreferencesDto } from "../dtos/school-settings.dto";
import { BRANDING_IMAGE_MAX_BYTES } from "../domain/branding-image";

/*
| SCHOOL SETTINGS ROUTES (school realm, mounted at /school-settings)
|   GET  /               school_settings.view     branding, report card template (null until the school saves it once)
|   PUT  /               school_settings.manage   change them (the custom letterhead template needs the plan feature report_cards.letterhead)
|   POST /stamp          school_settings.manage   multipart field "stamp": PNG, JPEG or WebP, 2 MB at most
|   POST /signature      school_settings.manage   multipart field "signature": same rules
|   GET  /preferences    school_settings.view     message and automation preferences with defaults
|   PUT  /preferences    school_settings.manage   { values: { key: value | null } }  null restores the default
| The permission check runs BEFORE the upload is read, so a person without it cannot push a file at all.
*/
const router = Router();
const ctrl = () => container.resolve<SchoolSettingsController>("schoolSettingsController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission)] as const;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: BRANDING_IMAGE_MAX_BYTES, files: 1 } });

router.get("/", ...guard("school_settings.view"), (q, s, n) => ctrl().getSettings(q, s, n));
router.put("/", ...guard("school_settings.manage"), validate(UpdateSchoolSettingsDto), (q, s, n) => ctrl().updateSettings(q, s, n));

router.get("/preferences", ...guard("school_settings.view"), (q, s, n) => ctrl().getPreferences(q, s, n));
router.put("/preferences", ...guard("school_settings.manage"), validate(UpdateSchoolPreferencesDto), (q, s, n) => ctrl().updatePreferences(q, s, n));

// multer leaves the tenant context behind, so it is re-established after it (same as before)
router.post("/stamp", ...guard("school_settings.manage"), upload.single("stamp"), reestablishTenantContext, (q, s, n) => ctrl().uploadStamp(q, s, n));
router.post("/signature", ...guard("school_settings.manage"), upload.single("signature"), reestablishTenantContext, (q, s, n) => ctrl().uploadSignature(q, s, n));

export default router;
