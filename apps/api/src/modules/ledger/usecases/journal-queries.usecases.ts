import { IJournalRepository } from "../repositories/journal.repository";
import { IFinancePeriodRepository } from "../repositories/finance-period.repository";
import { JournalMapper } from "../mappers/journal.mapper";
import { FinancePeriodMapper } from "../mappers/finance-period.mapper";
import { ledgerErrors } from "../domain/ledger.errors";
import { JournalFilters } from "../domain/ledger.entity";

interface Dependencies {
    journalRepository: IJournalRepository; financePeriodRepository: IFinancePeriodRepository;
    journalMapper: JournalMapper; financePeriodMapper: FinancePeriodMapper;
}

export class ListJournalsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(filters: JournalFilters) {
        const r = await this.d.journalRepository.listFiltered(filters);
        return { data: r.data.map(j => this.d.journalMapper.toSummary(j)), meta: r.meta };
    }
}

export class GetJournalUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string) {
        const journal = await this.d.journalRepository.findDetail(id);
        if (!journal) throw ledgerErrors.journalNotFound();
        return this.d.journalMapper.toDetail(journal);
    }
}

export class ListPeriodsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute() {
        return (await this.d.financePeriodRepository.listAll()).map(p => this.d.financePeriodMapper.toResponse(p));
    }
}
