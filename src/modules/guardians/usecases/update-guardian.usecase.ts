import { IGuardianRepository }   from "../repositories/guardian.repository";
import { GuardianMapper }        from "../mappers/guardian.mapper";
import { GuardianResponseData }  from "../mappers/guardian.mapper";
import { NotFoundError }         from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage }  from "../domain/guardian.enums";
import { UpdateGuardianDtoType } from "../dtos/guardian.dto";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    guardianMapper:     GuardianMapper;
}

export class UpdateGuardianUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly guardianMapper:     GuardianMapper;

    constructor({ guardianRepository, guardianMapper }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.guardianMapper     = guardianMapper;
    }

    async execute(
        id:  string,
        dto: UpdateGuardianDtoType,
    ): Promise<GuardianResponseData> {

        const guardian = await this.guardianRepository.findById(id);
        if (!guardian) {
            throw new NotFoundError(GuardianErrorMessage.NOT_FOUND);
        }

        const updated = await this.guardianRepository.update(id, dto);
        return this.guardianMapper.toResponse(updated);
    }
}