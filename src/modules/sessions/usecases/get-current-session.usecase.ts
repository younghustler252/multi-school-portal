import { ISessionRepository }  from "../repositories/session.repository";
import { SessionMapper }       from "../mappers/session.mapper";
import { TermMapper }          from "../mappers/session.mapper";
import { SessionResponseData } from "../mappers/session.mapper";
import { TermResponseData }    from "../mappers/session.mapper";
import { NotFoundError }       from "../../../shared/errors/domain.errors";

interface Dependencies {
    sessionRepository: ISessionRepository;
    sessionMapper:     SessionMapper;
    termMapper:        TermMapper;
}

export interface CurrentAcademicContext {
    session:     SessionResponseData;
    currentTerm: TermResponseData | null;
    allTerms:    TermResponseData[];
}

export class GetCurrentSessionUseCase {
    private readonly sessionRepository: ISessionRepository;
    private readonly sessionMapper:     SessionMapper;
    private readonly termMapper:        TermMapper;

    constructor({ sessionRepository, sessionMapper, termMapper }: Dependencies) {
        this.sessionRepository = sessionRepository;
        this.sessionMapper     = sessionMapper;
        this.termMapper        = termMapper;
    }

    async execute(): Promise<CurrentAcademicContext> {
        const session = await this.sessionRepository.findCurrentSession();
        if (!session) throw new NotFoundError("No current session set");

        const currentTerm = await this.sessionRepository.findCurrentTerm();
        const allTerms    = await this.sessionRepository
            .findTermsBySession(session.id);

        return {
            session:     this.sessionMapper.toResponse(session),
            currentTerm: currentTerm
                ? this.termMapper.toResponse(currentTerm)
                : null,
            allTerms:    allTerms.map(t => this.termMapper.toResponse(t)),
        };
    }
}