import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { BranchMapper } from "../mappers/branch.mapper";
import { BranchEntity } from "../domain/branch.entity";
import { IBranchRepository } from "./branch.repository";

export class BranchRepositoryImpl extends BaseTenantRepository<BranchEntity> implements IBranchRepository {
    protected readonly modelName = "branch";
    protected readonly softDelete = true;     // a branch is never erased: its records keep pointing at it

    constructor({ branchMapper }: { branchMapper: BranchMapper }) { super(branchMapper); }

    async findMain(): Promise<BranchEntity | null> { return this.findOne({ isMain: true }); }

    // Names are compared ignoring case: "Lekki" and "lekki" are the same branch
    async findByName(name: string): Promise<BranchEntity | null> {
        return this.findOne({ name: { equals: name.trim(), mode: "insensitive" } });
    }

    async findByCode(code: string): Promise<BranchEntity | null> { return this.findOne({ code: code.toUpperCase() }); }
}
