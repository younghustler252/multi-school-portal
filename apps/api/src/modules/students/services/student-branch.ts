import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { studentErrors } from "../domain/student.errors";

/*
| BRANCHES OF STUDENTS. Every student belongs to one branch. A student's branch changes ONLY through the transfer
| workflow (students/usecases/transfer-student.usecase.ts), never through edit, import or enrolment.
*/
type Db = Pick<ReturnType<typeof getTenantClient>, "branch" | "staffBranch">;
export interface BranchRef { id: string; name: string }

/** A branch a student may belong to: it exists, is active and is not deleted. */
export async function requireUsableBranch(branchId: string, db: Db = getTenantClient()): Promise<BranchRef> {
    const b = await db.branch.findUnique({ where: { id: branchId }, select: { id: true, name: true, isActive: true, deletedAt: true } });
    if (!b || b.deletedAt || !b.isActive) throw studentErrors.branchInvalid();
    return { id: b.id, name: b.name };
}

/*
| Which branch does a NEW student go to? The one asked for; else the creator's own branch (when they work in exactly
| one); else the main branch.
*/
export async function resolveNewStudentBranch(requested: string | undefined, creatorStaffId: string | null | undefined, db: Db = getTenantClient()): Promise<BranchRef> {
    if (requested) return requireUsableBranch(requested, db);
    if (creatorStaffId) {
        const own = await db.staffBranch.findMany({ where: { staffId: creatorStaffId, branch: { isActive: true, deletedAt: null } }, select: { branchId: true } });
        if (own.length === 1) return requireUsableBranch(own[0].branchId, db);
    }
    const main = await db.branch.findFirst({ where: { isMain: true, deletedAt: null }, select: { id: true } });
    if (!main) throw studentErrors.branchInvalid();
    return requireUsableBranch(main.id, db);
}

/** id -> name for a set of branches (one query), used to show `branch { id, name }` on responses. */
export async function branchNames(ids: string[], db: Pick<ReturnType<typeof getTenantClient>, "branch"> = getTenantClient()): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await db.branch.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
    return new Map(rows.map(r => [r.id, r.name]));
}
