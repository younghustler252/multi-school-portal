import { ISessionRepository }    from "../repositories/session.repository";
import { SessionMapper }         from "../mappers/session.mapper";
import { SessionResponseData }   from "../mappers/session.mapper";
import { ConflictError }         from "../../../shared/errors/domain.errors";
import { SessionErrorMessage }   from "../domain/session.enums";
import { CreateSessionDtoType }  from "../dtos/session.dto";

interface Dependencies {
    sessionRepository: ISessionRepository;
    sessionMapper:     SessionMapper;
}

export class CreateSessionUseCase {
    private readonly sessionRepository: ISessionRepository;
    private readonly sessionMapper:     SessionMapper;

    constructor({ sessionRepository, sessionMapper }: Dependencies) {
        this.sessionRepository = sessionRepository;
        this.sessionMapper     = sessionMapper;
    }

    async execute(dto: CreateSessionDtoType): Promise<SessionResponseData> {
        // ── Validate sessions don't overlap ───────────────────────────────
        const allSessions = await this.sessionRepository.findAllSessions();
        const newStart    = new Date(dto.startDate);
        const newEnd      = new Date(dto.endDate);

        const overlaps = allSessions.some(s =>
            newStart <= s.endDate && newEnd >= s.startDate,
        );

        if (overlaps) {
            throw new ConflictError(SessionErrorMessage.OVERLAPPING_DATES);
        }

        const session = await this.sessionRepository.createSession({
            name:      dto.name,
            startDate: newStart,
            endDate:   newEnd,
            isCurrent: false,
        });

        return this.sessionMapper.toResponse(session);
    }
}