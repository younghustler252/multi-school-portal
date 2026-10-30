import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { PaymentPerson, SchoolHeader } from "../domain/payment.entity";
import { IPaymentContextRepository } from "./payment-context.repository";

/* Not a table repository (it reads several tables), so it does not extend the base class. It uses the tenant client. */
export class PaymentContextRepositoryImpl implements IPaymentContextRepository {
    private get db() { return getTenantClient(); }

    async guardianExists(id: string) { return (await this.db.guardian.count({ where: { id } })) > 0; }

    async guardianChildIds(guardianId: string): Promise<string[]> {
        const rows = await this.db.studentGuardian.findMany({ where: { guardianId, student: { isActive: true } }, select: { studentId: true } });
        return rows.map(r => r.studentId);
    }

    async students(ids: string[]): Promise<PaymentPerson[]> {
        if (ids.length === 0) return [];
        const rows = await this.db.student.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
        return rows.map(r => ({ id: r.id, name: `${r.firstName} ${r.lastName}` }));
    }

    async attachmentExists(id: string) { return (await this.db.attachment.count({ where: { id, deletedAt: null } })) > 0; }

    async guardianContact(guardianId: string) {
        const g = await this.db.guardian.findUnique({ where: { id: guardianId }, select: { email: true, firstName: true, lastName: true, phone: true } });
        return g ? { email: g.email, name: `${g.firstName} ${g.lastName}`, phone: g.phone } : null;
    }

    async subaccountCode(schoolId: string) {
        const { prisma } = await import("../../../infrastructure/database/prisma/prisma.client");
        return (await prisma.school.findUnique({ where: { id: schoolId }, select: { paystackSubaccountCode: true } }))?.paystackSubaccountCode ?? null;
    }

    // The school's name lives in the platform database; the rest is the school's own letterhead settings
    async schoolHeader(schoolId: string): Promise<SchoolHeader> {
        const { prisma } = await import("../../../infrastructure/database/prisma/prisma.client");
        const [school, settings] = await Promise.all([
            prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
            this.db.schoolSettings.findFirst({ select: { address: true, logoUrl: true, principalName: true } }),
        ]);
        return { name: school?.name ?? null, address: settings?.address ?? null, logoUrl: settings?.logoUrl ?? null, principalName: settings?.principalName ?? null };
    }
}
