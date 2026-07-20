import { IFeeRepository }       from "../repositories/fee.repository";
import { FeeTypeMapper }        from "../mappers/fee.mapper";
import { FeeTypeResponseData }  from "../mappers/fee.mapper";
import { ConflictError }        from "../../../shared/errors/domain.errors";
import { FeeErrorMessage }      from "../domain/fee.enums";
import { CreateFeeTypeDtoType } from "../dtos/fee.dto";

interface Dependencies {
    feeRepository: IFeeRepository;
    feeTypeMapper: FeeTypeMapper;
}

export class CreateFeeTypeUseCase {
    private readonly feeRepository: IFeeRepository;
    private readonly feeTypeMapper: FeeTypeMapper;

    constructor({ feeRepository, feeTypeMapper }: Dependencies) {
        this.feeRepository = feeRepository;
        this.feeTypeMapper = feeTypeMapper;
    }

    async execute(dto: CreateFeeTypeDtoType): Promise<FeeTypeResponseData> {
        const existing = await this.feeRepository.findFeeTypeByName(dto.name);
        if (existing) throw new ConflictError(FeeErrorMessage.FEE_TYPE_NAME_TAKEN);

        const feeType = await this.feeRepository.createFeeType(dto);
        return this.feeTypeMapper.toResponse(feeType);
    }
}