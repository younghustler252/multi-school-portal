import { ISessionRepository } from "../repositories/session.repository";
import { TermMapper }         from "../mappers/session.mapper";
import { TermResponseData }   from "../mappers/session.mapper";
import { NotFoundError }      from "../../../shared/errors/domain.errors";
import { SessionErrorMessage } from "../domain/session.enums";
import { UpdateTermDtoType }  from "../dtos/session.dto";

interface Dependencies {
    sessionRepository: ISessionRepository;
    termMapper:        TermMapper;
}

export class UpdateTermUseCase {
    private readonly sessionRepository: ISessionRepository;
    private readonly termMapper:        TermMapper;

    constructor({ sessionRepository, termMapper }: Dependencies) {
        this.sessionRepository = sessionRepository;
        this.termMapper        = termMapper;
    }

    async execute(
        id:  string,
        dto: UpdateTermDtoType,
    ): Promise<TermResponseData> {
        const term = await this.sessionRepository.findTermById(id);
        if (!term) throw new NotFoundError(SessionErrorMessage.TERM_NOT_FOUND);

        const updateData: Record<string, any> = {};
        if (dto.startDate) updateData.startDate = new Date(dto.startDate);
        if (dto.endDate)   updateData.endDate   = new Date(dto.endDate);

        const updated = await this.sessionRepository.updateTerm(id, updateData);
        return this.termMapper.toResponse(updated);
    }
}