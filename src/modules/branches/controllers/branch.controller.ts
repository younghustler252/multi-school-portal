import { Request, Response, NextFunction } from "express";
import { ListBranchesUseCase, GetMyBranchesUseCase, GetBranchUseCase, ListBranchMembersUseCase } from "../usecases/branch-queries.usecases";
import { CreateBranchUseCase, UpdateBranchUseCase, SetBranchActiveUseCase, DeleteBranchUseCase } from "../usecases/branch-commands.usecases";
import { AssignBranchesUseCase } from "../usecases/assign-branches.usecase";
import { sendSuccess, sendCreated } from "../../../shared/utils/api-response";
import { getAccess } from "../../../infrastructure/middleware/rbac.middleware";
import { branchErrors } from "../domain/branch.errors";

interface Dependencies {
    listBranchesUseCase: ListBranchesUseCase; getMyBranchesUseCase: GetMyBranchesUseCase; getBranchUseCase: GetBranchUseCase;
    listBranchMembersUseCase: ListBranchMembersUseCase; createBranchUseCase: CreateBranchUseCase; updateBranchUseCase: UpdateBranchUseCase;
    setBranchActiveUseCase: SetBranchActiveUseCase; deleteBranchUseCase: DeleteBranchUseCase; assignBranchesUseCase: AssignBranchesUseCase;
}

// The school is the one the host resolved to; the person is req.auth. Nothing comes from the body.
const schoolIdOf = (req: Request): string => req.schoolId as string;
const userIdOf   = (req: Request): string => { if (!req.auth) throw branchErrors.notFound(); return req.auth.userId; };
const idOf       = (req: Request): string => String(req.params.id);

export class BranchController {
    constructor(private readonly d: Dependencies) {}

    list   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.listBranchesUseCase.execute(getAccess(req), req.query.includeInactive === "true"), "Branches retrieved successfully"); } catch (e) { next(e); } };
    mine   = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getMyBranchesUseCase.execute(getAccess(req)), "Your branches retrieved successfully"); } catch (e) { next(e); } };
    get    = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.getBranchUseCase.execute(idOf(req), getAccess(req)), "Branch retrieved successfully"); } catch (e) { next(e); } };
    members = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.listBranchMembersUseCase.execute(idOf(req)), "Branch members retrieved successfully"); } catch (e) { next(e); } };
    create = async (req: Request, res: Response, next: NextFunction) => { try { sendCreated(res, await this.d.createBranchUseCase.execute(schoolIdOf(req), userIdOf(req), req.body), "Branch created successfully"); } catch (e) { next(e); } };
    update = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.updateBranchUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), req.body), "Branch updated successfully"); } catch (e) { next(e); } };
    deactivate = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.setBranchActiveUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), false), "Branch deactivated"); } catch (e) { next(e); } };
    reactivate = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.setBranchActiveUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req), true), "Branch reactivated"); } catch (e) { next(e); } };
    remove = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.deleteBranchUseCase.execute(idOf(req), schoolIdOf(req), userIdOf(req)), "Branch deleted"); } catch (e) { next(e); } };
    assign = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.d.assignBranchesUseCase.execute(String(req.params.membershipId), schoolIdOf(req), userIdOf(req), req.body), "Branch assignments updated"); } catch (e) { next(e); } };
}
