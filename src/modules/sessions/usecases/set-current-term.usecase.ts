import { ISessionRepository } from "../repositories/session.repository";
import { TermMapper }         from "../mappers/session.mapper";
import { TermResponseData }   from "../mappers/session.mapper";
import { NotFoundError }      from "../../../shared/errors/domain.errors";
import { SessionErrorMessage } from "../domain/session.enums";

interface Dependencies {
    sessionRepository: ISessionRepository;
    termMapper:        TermMapper;
}

export class SetCurrentTermUseCase {
    private readonly sessionRepository: ISessionRepository;
    private readonly termMapper:        TermMapper;

    constructor({ sessionRepository, termMapper }: Dependencies) {
        this.sessionRepository = sessionRepository;
        this.termMapper        = termMapper;
    }

    async execute(termId: string): Promise<TermResponseData> {
        const term = await this.sessionRepository.findTermById(termId);
        if (!term) throw new NotFoundError(SessionErrorMessage.TERM_NOT_FOUND);

        const updated = await this.sessionRepository.setCurrentTerm(termId);
        return this.termMapper.toResponse(updated);
    }
}