import { NumberSequenceService } from "../../../shared/services/number-sequence.service";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { EMPLOYEE_ID_SEQUENCE, MAX_EMPLOYEE_ID_TRIES, formatEmployeeId } from "../domain/staff.policy";
import { staffErrors } from "../domain/staff.errors";

type Tx = Parameters<NumberSequenceService["next"]>[2] & { staff: ReturnType<typeof getTenantClient>["staff"] };

/**
 * Next free employee id. Runs INSIDE the creating transaction, so the counter only moves if the staff member is
 * saved. An id someone typed by hand earlier is skipped within the same transaction. (The old way let the save fail
 * on a taken id; the rollback also undid the counter, so every retry got the same taken id again.)
 */
export async function nextEmployeeId(seq: Pick<NumberSequenceService, "next">, tx: Tx): Promise<string> {
    for (let i = 0; i < MAX_EMPLOYEE_ID_TRIES; i++) {
        const candidate = formatEmployeeId(await seq.next(EMPLOYEE_ID_SEQUENCE, "", tx));
        if (!(await tx.staff.findUnique({ where: { employeeId: candidate }, select: { id: true } }))) return candidate;
    }
    throw staffErrors.employeeIdFailed();
}
