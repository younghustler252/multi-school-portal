import type { Access } from "../../../foundation/access.service";
import { IClassRepository } from "../repositories/class.repository";
import { classErrors } from "../domain/class.errors";

/*
| BRANCH RULES FOR CLASSES. Every class belongs to one branch. A person with classes.view / classes.manage at ALL scope
| works with every class; at BRANCH scope only with the classes of the branches they are assigned to.
|   canView    a class outside your branches looks like it does not exist (404), so nothing leaks.
|   canManage  you can see it but may not change it: BRANCH_OUT_OF_SCOPE (403).
|   requireAll school-wide actions (subjects, teaching defaults) need ALL scope: a branch person cannot change them.
*/

/** The classes the person may see: "ALL", or the branch ids they are limited to. */
export const viewScope = (access: Access): "ALL" | string[] => access.branchScope("classes.view") ?? [];

export function assertCanView(cls: { branchId: string }, access: Access): void {
    if (!access.canActInBranch("classes.view", cls.branchId)) throw classErrors.notFound();
}

export function assertCanManage(cls: { branchId: string }, access: Access): void {
    if (!access.canActInBranch("classes.view", cls.branchId)) throw classErrors.notFound();
    if (!access.canActInBranch("classes.manage", cls.branchId)) throw classErrors.branchOutOfScope();
}

export function requireAll(access: Access): void {
    if (access.scopeOf("classes.manage") !== "ALL") throw classErrors.allBranchesRequired();
}

/** Loads a class and checks the person may manage it (used by every route that changes one class). */
export async function loadManageable(repo: IClassRepository, classId: string, access: Access) {
    const cls = await repo.findClassById(classId);
    if (!cls) throw classErrors.notFound();
    assertCanManage(cls, access);
    return cls;
}

/** A branch a class may be placed in: it exists, is active, and is one the person may manage. */
export async function requireUsableBranch(repo: IClassRepository, branchId: string, access: Access) {
    const branch = await repo.findBranchById(branchId);
    if (!branch || branch.deletedAt || !branch.isActive) throw classErrors.branchInvalid();
    if (!access.canActInBranch("classes.manage", branchId)) throw classErrors.branchOutOfScope();
    return branch;
}

/* Which branch does a NEW class go to? The one asked for; else your only branch; else (school-wide access) the main branch. */
export async function resolveNewClassBranch(repo: IClassRepository, requested: string | undefined, access: Access) {
    if (requested) return requireUsableBranch(repo, requested, access);
    const scope = access.branchScope("classes.manage");
    if (Array.isArray(scope)) {
        if (scope.length === 0) throw classErrors.branchOutOfScope();
        if (scope.length > 1) throw classErrors.branchRequired();
        return requireUsableBranch(repo, scope[0], access);
    }
    const main = await repo.findMainBranch();
    if (!main) throw classErrors.branchInvalid();
    return requireUsableBranch(repo, main.id, access);
}
