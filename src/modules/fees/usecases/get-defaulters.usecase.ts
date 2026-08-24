import { IFeeRepository } from "../repositories/fee.repository";

export interface DefaulterEntry {
    studentId:     string;
    studentName:   string;
    totalOwedKobo: number;
    invoiceCount:  number;
}

interface Dependencies {
    feeRepository: IFeeRepository;
}

export class GetDefaultersUseCase {
    private readonly feeRepository: IFeeRepository;

    constructor({ feeRepository }: Dependencies) {
        this.feeRepository = feeRepository;
    }

    async execute(termId: string): Promise<DefaulterEntry[]> {
        return this.feeRepository.findDefaultersSummaryByTerm(termId);
    }
}