import { getTenantClient } from "../../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../../audit/services/audit.service";
import { IClassRepository } from "../../repositories/class.repository";
import { classErrors } from "../../domain/class.errors";
import { ClassActor } from "../../domain/class.types";
import { classUsage } from "../../services/class-rules";

interface Dependencies { classRepository: IClassRepository; auditService: AuditService }

/*
| DELETE CLASS. Refused (CLASS_IN_USE, with counts) while anything still points at the class: enrolments,
| subject assignments, fee structures, invoices, or another class that is promoted into it. An empty class is
| removed together with its own promotion row, in one transaction.
*/
export class DeleteClassUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, actor: ClassActor): Promise<{ deleted: true; name: string }> {
        const cls = await this.d.classRepository.findClassById(id);
        if (!cls) throw classErrors.notFound();

        try {
            await getTenantClient().$transaction(async tx => {
                const used = await classUsage(tx as any, id);
                if (Object.keys(used).length > 0) throw classErrors.inUse(used);
                await tx.classProgression.deleteMany({ where: { fromClassId: id } });
                await tx.class.delete({ where: { id } });
            });
        } catch (err: any) {
            if (err?.code === "P2003") throw classErrors.inUse({});   // a link we did not count: the database refused
            throw err;
        }

        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "class.deleted", entity: "Class", entityId: id, oldValue: { name: cls.name } });
        return { deleted: true, name: cls.name };
    }
}
