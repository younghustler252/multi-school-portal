import { Router } from "express";
import { container } from "../../../container";
import { FeeSetupController } from "../controllers/fee-setup.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { requireFeature } from "../../../infrastructure/middleware/feature-gate.middleware";
import {
    CreateFeeTypeDto, UpdateFeeTypeDto, CreateFeeStructureDto, UpdateFeeStructureDto,
    CreateDiscountRuleDto, UpdateDiscountRuleDto, GiveStudentDiscountDto,
} from "../dtos/fee-setup.dto";

/*
| FEE SET-UP ROUTES (school realm, mounted at /fees on the school's host).
| Every route: authenticate, tenant, permission, then the fees entitlement (modules.fees), then validation.
|   GET    /types, /types/:id                         fees.setup.view      (?status=active|inactive|all, ?q=)
|   POST   /types                                     fees.types.manage
|   PUT    /types/:id, DELETE /types/:id              fees.types.manage    (delete only if never used)
|   GET    /structures, /structures/:id               fees.setup.view      (?sessionId, ?termId, ?classId, ?branchId, ?status)
|   POST   /structures                                fees.structures.manage
|   PUT    /structures/:id, DELETE /structures/:id    fees.structures.manage
|   GET    /discount-rules                            fees.setup.view      (?status, ?kind)
|   POST   /discount-rules                            fees.discounts.manage
|   PUT    /discount-rules/:id, DELETE /discount-rules/:id   fees.discounts.manage
|   GET    /students/:studentId/discounts             fees.setup.view
|   POST   /students/:studentId/discounts             fees.discounts.manage
|   DELETE /students/:studentId/discounts/:discountId fees.discounts.manage
*/
const router = Router();
const ctrl = () => container.resolve<FeeSetupController>("feeSetupController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission), requireFeature("modules.fees")] as const;

router.get("/types", ...guard("fees.setup.view"), (q, s, n) => ctrl().listTypes(q, s, n));
router.post("/types", ...guard("fees.types.manage"), validate(CreateFeeTypeDto), (q, s, n) => ctrl().createType(q, s, n));
router.get("/types/:id", ...guard("fees.setup.view"), (q, s, n) => ctrl().getType(q, s, n));
router.put("/types/:id", ...guard("fees.types.manage"), validate(UpdateFeeTypeDto), (q, s, n) => ctrl().updateType(q, s, n));
router.delete("/types/:id", ...guard("fees.types.manage"), (q, s, n) => ctrl().deleteType(q, s, n));

router.get("/structures", ...guard("fees.setup.view"), (q, s, n) => ctrl().listStructures(q, s, n));
router.post("/structures", ...guard("fees.structures.manage"), validate(CreateFeeStructureDto), (q, s, n) => ctrl().createStructure(q, s, n));
router.get("/structures/:id", ...guard("fees.setup.view"), (q, s, n) => ctrl().getStructure(q, s, n));
router.put("/structures/:id", ...guard("fees.structures.manage"), validate(UpdateFeeStructureDto), (q, s, n) => ctrl().updateStructure(q, s, n));
router.delete("/structures/:id", ...guard("fees.structures.manage"), (q, s, n) => ctrl().deleteStructure(q, s, n));

router.get("/discount-rules", ...guard("fees.setup.view"), (q, s, n) => ctrl().listDiscountRules(q, s, n));
router.post("/discount-rules", ...guard("fees.discounts.manage"), validate(CreateDiscountRuleDto), (q, s, n) => ctrl().createDiscountRule(q, s, n));
router.put("/discount-rules/:id", ...guard("fees.discounts.manage"), validate(UpdateDiscountRuleDto), (q, s, n) => ctrl().updateDiscountRule(q, s, n));
router.delete("/discount-rules/:id", ...guard("fees.discounts.manage"), (q, s, n) => ctrl().deleteDiscountRule(q, s, n));

router.get("/students/:studentId/discounts", ...guard("fees.setup.view"), (q, s, n) => ctrl().listStudentDiscounts(q, s, n));
router.post("/students/:studentId/discounts", ...guard("fees.discounts.manage"), validate(GiveStudentDiscountDto), (q, s, n) => ctrl().giveStudentDiscount(q, s, n));
router.delete("/students/:studentId/discounts/:discountId", ...guard("fees.discounts.manage"), (q, s, n) => ctrl().removeStudentDiscount(q, s, n));

export default router;
