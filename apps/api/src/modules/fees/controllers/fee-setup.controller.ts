import { Request, Response, NextFunction } from "express";
import { ListFeeTypesUseCase, GetFeeTypeUseCase, CreateFeeTypeUseCase, UpdateFeeTypeUseCase, DeleteFeeTypeUseCase } from "../usecases/fee-type.usecases";
import { ListFeeStructuresUseCase, GetFeeStructureUseCase, CreateFeeStructureUseCase, UpdateFeeStructureUseCase, DeleteFeeStructureUseCase } from "../usecases/fee-structure.usecases";
import {
    ListDiscountRulesUseCase, CreateDiscountRuleUseCase, UpdateDiscountRuleUseCase, DeleteDiscountRuleUseCase,
    ListStudentDiscountsUseCase, GiveStudentDiscountUseCase, RemoveStudentDiscountUseCase,
} from "../usecases/fee-discount.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { ListFeeTypesQuery, ListFeeStructuresQuery, ListDiscountRulesQuery } from "../dtos/fee-setup.dto";

interface Dependencies {
    listFeeTypesUseCase: ListFeeTypesUseCase; getFeeTypeUseCase: GetFeeTypeUseCase; createFeeTypeUseCase: CreateFeeTypeUseCase;
    updateFeeTypeUseCase: UpdateFeeTypeUseCase; deleteFeeTypeUseCase: DeleteFeeTypeUseCase;
    listFeeStructuresUseCase: ListFeeStructuresUseCase; getFeeStructureUseCase: GetFeeStructureUseCase; createFeeStructureUseCase: CreateFeeStructureUseCase;
    updateFeeStructureUseCase: UpdateFeeStructureUseCase; deleteFeeStructureUseCase: DeleteFeeStructureUseCase;
    listDiscountRulesUseCase: ListDiscountRulesUseCase; createDiscountRuleUseCase: CreateDiscountRuleUseCase;
    updateDiscountRuleUseCase: UpdateDiscountRuleUseCase; deleteDiscountRuleUseCase: DeleteDiscountRuleUseCase;
    listStudentDiscountsUseCase: ListStudentDiscountsUseCase; giveStudentDiscountUseCase: GiveStudentDiscountUseCase;
    removeStudentDiscountUseCase: RemoveStudentDiscountUseCase;
}

/*
| FEE SET-UP CONTROLLER (school realm, /fees). The school is the one the host resolved to; the person is req.auth.
| Bodies are already validated by the route; query strings are parsed here.
*/
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const param      = (req: Request, name: string): string => String(req.params[name]);

export class FeeSetupController {
    constructor(private readonly d: Dependencies) {}

    /* fee types */
    listTypes = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listFeeTypesUseCase.execute(ListFeeTypesQuery.parse(req.query)), "Fee types retrieved successfully"); } catch (e) { next(e); }
    };
    getType = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getFeeTypeUseCase.execute(param(req, "id")), "Fee type retrieved successfully"); } catch (e) { next(e); }
    };
    createType = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createFeeTypeUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Fee type created successfully"); } catch (e) { next(e); }
    };
    updateType = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateFeeTypeUseCase.execute(param(req, "id"), schoolIdOf(req), userIdOf(req), req.body), "Fee type updated successfully"); } catch (e) { next(e); }
    };
    deleteType = async (req: Request, res: Response, next: NextFunction) => {
        try { await this.d.deleteFeeTypeUseCase.execute(param(req, "id"), schoolIdOf(req), userIdOf(req)); sendSuccess(res, null, "Fee type deleted successfully"); } catch (e) { next(e); }
    };

    /* fee structures */
    listStructures = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listFeeStructuresUseCase.execute(ListFeeStructuresQuery.parse(req.query)), "Fee structures retrieved successfully"); } catch (e) { next(e); }
    };
    getStructure = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getFeeStructureUseCase.execute(param(req, "id")), "Fee structure retrieved successfully"); } catch (e) { next(e); }
    };
    createStructure = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createFeeStructureUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Fee structure created successfully"); } catch (e) { next(e); }
    };
    updateStructure = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateFeeStructureUseCase.execute(param(req, "id"), schoolIdOf(req), userIdOf(req), req.body), "Fee structure updated successfully"); } catch (e) { next(e); }
    };
    deleteStructure = async (req: Request, res: Response, next: NextFunction) => {
        try { await this.d.deleteFeeStructureUseCase.execute(param(req, "id"), schoolIdOf(req), userIdOf(req)); sendSuccess(res, null, "Fee structure deleted successfully"); } catch (e) { next(e); }
    };

    /* discount rules */
    listDiscountRules = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listDiscountRulesUseCase.execute(ListDiscountRulesQuery.parse(req.query)), "Discount rules retrieved successfully"); } catch (e) { next(e); }
    };
    createDiscountRule = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createDiscountRuleUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Discount rule created successfully"); } catch (e) { next(e); }
    };
    updateDiscountRule = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateDiscountRuleUseCase.execute(param(req, "id"), schoolIdOf(req), userIdOf(req), req.body), "Discount rule updated successfully"); } catch (e) { next(e); }
    };
    deleteDiscountRule = async (req: Request, res: Response, next: NextFunction) => {
        try { await this.d.deleteDiscountRuleUseCase.execute(param(req, "id"), schoolIdOf(req), userIdOf(req)); sendSuccess(res, null, "Discount rule deleted successfully"); } catch (e) { next(e); }
    };

    /* a student's discounts */
    listStudentDiscounts = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.listStudentDiscountsUseCase.execute(param(req, "studentId")), "Student discounts retrieved successfully"); } catch (e) { next(e); }
    };
    giveStudentDiscount = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.giveStudentDiscountUseCase.execute(param(req, "studentId"), schoolIdOf(req), userIdOf(req), req.body), "Discount given successfully"); } catch (e) { next(e); }
    };
    removeStudentDiscount = async (req: Request, res: Response, next: NextFunction) => {
        try { await this.d.removeStudentDiscountUseCase.execute(param(req, "studentId"), param(req, "discountId"), schoolIdOf(req), userIdOf(req)); sendSuccess(res, null, "Discount removed successfully"); } catch (e) { next(e); }
    };
}
