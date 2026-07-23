import { ISessionRepository }  from "../repositories/session.repository";
import { SessionMapper }       from "../mappers/session.mapper";
import { SessionResponseData } from "../mappers/session.mapper";
import { NotFoundError }       from "../../../shared/errors/domain.errors";
import { SessionErrorMessage } from "../domain/session.enums";

interface Dependencies {
    sessionRepository: ISessionRepository;
    sessionMapper:     SessionMapper;
}

export class SetCurrentSessionUseCase {
    private readonly sessionRepository: ISessionRepository;
    private readonly sessionMapper:     SessionMapper;

    constructor({ sessionRepository, sessionMapper }: Dependencies) {
        this.sessionRepository = sessionRepository;
        this.sessionMapper     = sessionMapper;
    }

    async execute(sessionId: string): Promise<SessionResponseData> {
        const session = await this.sessionRepository.findSessionById(sessionId);
        if (!session) throw new NotFoundError(SessionErrorMessage.NOT_FOUND);

        const updated = await this.sessionRepository
            .setCurrentSession(sessionId);
        return this.sessionMapper.toResponse(updated);
    }
}