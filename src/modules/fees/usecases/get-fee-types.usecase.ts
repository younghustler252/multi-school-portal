import { IFeeRepository }      from "../repositories/fee.repository";
import { FeeTypeMapper }       from "../mappers/fee.mapper";
import { FeeTypeResponseData } from "../mappers/fee.mapper";

interface Dependencies {
    feeRepository: IFeeRepository;
    feeTypeMapper: FeeTypeMapper;
}

export class GetFeeTypesUseCase {
    private readonly feeRepository: IFeeRepository;
    private readonly feeTypeMapper: FeeTypeMapper;

    constructor({ feeRepository, feeTypeMapper }: Dependencies) {
        this.feeRepository = feeRepository;
        this.feeTypeMapper = feeTypeMapper;
    }

    async execute(): Promise<FeeTypeResponseData[]> {
        const types = await this.feeRepository.findAllFeeTypes();
        return types.map(t => this.feeTypeMapper.toResponse(t));
    }
}