import { Router } from "express";
import { container } from "../../../container";
import { VendorController } from "../controllers/vendor.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import { CreateVendorDto, UpdateVendorDto } from "../dtos/vendor.dto";

/*
| VENDOR ROUTES (school realm, mounted at /vendors). The account number is encrypted; responses show the last four digits only.
|   GET /  (?q, ?status=active|inactive|all, ?page, ?limit), GET /:id     expenses.view
|   POST /, PUT /:id, POST /:id/deactivate, POST /:id/reactivate, DELETE /:id   vendors.manage
*/
const router = Router();
const ctrl = () => container.resolve<VendorController>("vendorController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.expenses")] as const;

router.get("/", ...guard("expenses.view"), (q, s, n) => ctrl().list(q, s, n));
router.post("/", ...guard("vendors.manage"), validate(CreateVendorDto), (q, s, n) => ctrl().create(q, s, n));
router.get("/:id", ...guard("expenses.view"), (q, s, n) => ctrl().get(q, s, n));
router.put("/:id", ...guard("vendors.manage"), validate(UpdateVendorDto), (q, s, n) => ctrl().update(q, s, n));
router.post("/:id/deactivate", ...guard("vendors.manage"), (q, s, n) => ctrl().setActive(false)(q, s, n));
router.post("/:id/reactivate", ...guard("vendors.manage"), (q, s, n) => ctrl().setActive(true)(q, s, n));
router.delete("/:id", ...guard("vendors.manage"), (q, s, n) => ctrl().remove(q, s, n));

export default router;
