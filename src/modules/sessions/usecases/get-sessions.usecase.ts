import { ISessionRepository }   from "../repositories/session.repository";
import { SessionMapper }        from "../mappers/session.mapper";
import { SessionResponseData }  from "../mappers/session.mapper";

interface Dependencies {
    sessionRepository: ISessionRepository;
    sessionMapper:     SessionMapper;
}

export class GetSessionsUseCase {
    private readonly sessionRepository: ISessionRepository;
    private readonly sessionMapper:     SessionMapper;

    constructor({ sessionRepository, sessionMapper }: Dependencies) {
        this.sessionRepository = sessionRepository;
        this.sessionMapper     = sessionMapper;
    }

    async execute(): Promise<SessionResponseData[]> {
        const sessions = await this.sessionRepository.findAllSessions();
        return sessions.map(s => this.sessionMapper.toResponse(s));
    }
}