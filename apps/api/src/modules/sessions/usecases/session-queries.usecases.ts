import { ISessionRepository } from "../repositories/session.repository";
import { SessionMapper, TermMapper, SessionResponseData, TermResponseData } from "../mappers/session.mapper";

interface Dependencies { sessionRepository: ISessionRepository; sessionMapper: SessionMapper; termMapper: TermMapper }

/** All sessions, newest first, each with its terms. */
export class ListSessionsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(): Promise<SessionResponseData[]> {
        return (await this.d.sessionRepository.findAllSessions()).map(s => this.d.sessionMapper.toResponse(s));
    }
}

export interface CurrentAcademicYear { session: SessionResponseData | null; currentTerm: TermResponseData | null }

/**
 * The current session (with its terms) and the current term (with its session's name).
 * Either is null until the school has chosen one. Used by every screen, so it is open to everyone who signs in.
 */
export class GetCurrentAcademicYearUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(): Promise<CurrentAcademicYear> {
        const { sessionRepository: repo, sessionMapper, termMapper } = this.d;
        const [session, term] = await Promise.all([repo.findCurrentSession(), repo.findCurrentTerm()]);
        const full = session ? await repo.findSessionById(session.id) : null;
        const owner = term && full && term.sessionId === full.id ? full : term ? await repo.findSessionById(term.sessionId) : null;
        return {
            session: full ? sessionMapper.toResponse(full) : null,
            currentTerm: term ? termMapper.toResponse(term, owner ? { id: owner.id, name: owner.name } : undefined) : null,
        };
    }
}
