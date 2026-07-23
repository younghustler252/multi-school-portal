import { ISessionRepository }  from "../repositories/session.repository";
import { TermMapper }          from "../mappers/session.mapper";
import { TermResponseData }    from "../mappers/session.mapper";
import {
    NotFoundError,
    ConflictError,
}                              from "../../../shared/errors/domain.errors";
import { SessionErrorMessage } from "../domain/session.enums";
import { CreateTermDtoType }   from "../dtos/session.dto";

interface Dependencies {
    sessionRepository: ISessionRepository;
    termMapper:        TermMapper;
}

export class CreateTermUseCase {
    private readonly sessionRepository: ISessionRepository;
    private readonly termMapper:        TermMapper;

    constructor({ sessionRepository, termMapper }: Dependencies) {
        this.sessionRepository = sessionRepository;
        this.termMapper        = termMapper;
    }

    async execute(dto: CreateTermDtoType): Promise<TermResponseData> {
        // ── Check session exists ──────────────────────────────────────────
        const session = await this.sessionRepository
            .findSessionById(dto.sessionId);
        if (!session) throw new NotFoundError(SessionErrorMessage.NOT_FOUND);

        // ── Check term name not taken in this session ─────────────────────
        const existingTerms = await this.sessionRepository
            .findTermsBySession(dto.sessionId);

        const nameTaken = existingTerms.some(t => t.name === dto.name);
        if (nameTaken) throw new ConflictError(SessionErrorMessage.TERM_NAME_TAKEN);

        const term = await this.sessionRepository.createTerm({
            sessionId: dto.sessionId,
            name:      dto.name,
            startDate: new Date(dto.startDate),
            endDate:   new Date(dto.endDate),
            isCurrent: false,
        });

        return this.termMapper.toResponse(term);
    }
}