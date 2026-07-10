import { IGuardianRepository }  from "../repositories/guardian.repository";
import { GuardianMapper }       from "../mappers/guardian.mapper";
import { GuardianResponseData } from "../mappers/guardian.mapper";
import { NotFoundError }        from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage } from "../domain/guardian.enums";

interface Dependencies {
    guardianRepository: IGuardianRepository;
    guardianMapper:     GuardianMapper;
}

export class GetGuardianUseCase {
    private readonly guardianRepository: IGuardianRepository;
    private readonly guardianMapper:     GuardianMapper;

    constructor({ guardianRepository, guardianMapper }: Dependencies) {
        this.guardianRepository = guardianRepository;
        this.guardianMapper     = guardianMapper;
    }

    async execute(id: string): Promise<GuardianResponseData> {
        const guardian = await this.guardianRepository.findById(id);

        if (!guardian) {
            throw new NotFoundError(GuardianErrorMessage.NOT_FOUND);
        }

        return this.guardianMapper.toResponse(guardian);
    }
}