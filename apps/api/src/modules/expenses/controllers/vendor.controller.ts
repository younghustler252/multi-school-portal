import { Request, Response, NextFunction } from "express";
import { ListVendorsUseCase, GetVendorUseCase, CreateVendorUseCase, UpdateVendorUseCase, SetVendorActiveUseCase, DeleteVendorUseCase } from "../usecases/vendor.usecases";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { UnauthorizedError } from "../../../shared/errors/domain.errors";
import { ListVendorsQuery } from "../dtos/vendor.dto";

interface Dependencies {
    listVendorsUseCase: ListVendorsUseCase; getVendorUseCase: GetVendorUseCase; createVendorUseCase: CreateVendorUseCase;
    updateVendorUseCase: UpdateVendorUseCase; setVendorActiveUseCase: SetVendorActiveUseCase; deleteVendorUseCase: DeleteVendorUseCase;
}
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw new UnauthorizedError("No token provided", "TOKEN_MISSING"); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

/* VENDOR CONTROLLER (school realm, /vendors). */
export class VendorController {
    constructor(private readonly d: Dependencies) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const r = await this.d.listVendorsUseCase.execute(ListVendorsQuery.parse(req.query));
            res.status(200).json({ success: true, message: "Vendors retrieved successfully", data: r.data, meta: r.meta });
        } catch (e) { next(e); }
    };
    get = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.getVendorUseCase.execute(idOf(req)), "Vendor retrieved successfully"); } catch (e) { next(e); }
    };
    create = async (req: Request, res: Response, next: NextFunction) => {
        try { sendCreated(res, await this.d.createVendorUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Vendor created successfully"); } catch (e) { next(e); }
    };
    update = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.updateVendorUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Vendor updated successfully"); } catch (e) { next(e); }
    };
    setActive = (isActive: boolean) => async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.setVendorActiveUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), isActive), isActive ? "Vendor reactivated" : "Vendor deactivated"); } catch (e) { next(e); }
    };
    remove = async (req: Request, res: Response, next: NextFunction) => {
        try { sendSuccess(res, await this.d.deleteVendorUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Vendor deleted successfully"); } catch (e) { next(e); }
    };
}
