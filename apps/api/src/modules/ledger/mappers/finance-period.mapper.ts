import type { FinancePeriod } from "../../../generated/tenant";
import { IMapper } from "../../../infrastructure/repository/base.repository";
import { FinancePeriodEntity, PeriodStatus } from "../domain/ledger.entity";
import { dayOut } from "./kobo";

export interface FinancePeriodResponse {
    id: string; name: string; startDate: string; endDate: string; status: string;
    closedAt: Date | null; reopenedAt: Date | null; reopenReason: string | null;
}

export class FinancePeriodMapper implements IMapper<FinancePeriod, FinancePeriodEntity> {
    toDomain(raw: FinancePeriod): FinancePeriodEntity {
        return {
            id: raw.id, name: raw.name, startDate: raw.startDate, endDate: raw.endDate, status: raw.status as PeriodStatus,
            closedAt: raw.closedAt, reopenedAt: raw.reopenedAt, reopenReason: raw.reopenReason,
        };
    }

    toResponse(e: FinancePeriodEntity): FinancePeriodResponse {
        return {
            id: e.id, name: e.name, startDate: dayOut(e.startDate), endDate: dayOut(e.endDate), status: e.status,
            closedAt: e.closedAt, reopenedAt: e.reopenedAt, reopenReason: e.reopenReason,
        };
    }
}
