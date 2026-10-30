import { isUniqueViolation } from "../../../shared/errors/unique-violation";
import { AuditService } from "../../audit/services/audit.service";
import { ISessionRepository } from "../repositories/session.repository";
import { SessionMapper, TermMapper, SessionResponseData, TermResponseData } from "../mappers/session.mapper";
import { sessionErrors } from "../domain/session.errors";
import { firstOverlap, rangeInside } from "../domain/session.policy";
import { SessionActor } from "../domain/session.types";
import { CreateSessionDtoType, UpdateSessionDtoType, CreateTermDtoType, UpdateTermDtoType } from "../dtos/session.dto";

interface Dependencies { sessionRepository: ISessionRepository; sessionMapper: SessionMapper; termMapper: TermMapper; auditService: AuditService }
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const day = (d: Date) => d.toISOString().slice(0, 10);

/* CREATE SESSION. Name "2025/2026" is unique (any capitals); its dates may not overlap another session. */
export class CreateSessionUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, dto: CreateSessionDtoType, actor: SessionActor): Promise<SessionResponseData> {
        const { sessionRepository: repo } = this.d;
        const all = await repo.findAllSessions();
        if (all.some(s => sameName(s.name, dto.name))) throw sessionErrors.sessionNameTaken();
        const range = { startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) };
        const clash = firstOverlap(range, all);
        if (clash) throw sessionErrors.sessionOverlap(clash.name);

        const created = await repo.createSession({ name: dto.name, ...range }).catch(err => { throw isUniqueViolation(err) ? sessionErrors.sessionNameTaken() : err; });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "session.created", entity: "Session", entityId: created.id, newValue: { name: dto.name, startDate: dto.startDate, endDate: dto.endDate } });
        return this.d.sessionMapper.toResponse({ ...created, terms: [] });
    }
}

/* UPDATE SESSION. The new dates must still contain every term of the session, and must not overlap another session. */
export class UpdateSessionUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, id: string, dto: UpdateSessionDtoType, actor: SessionActor): Promise<SessionResponseData> {
        const { sessionRepository: repo } = this.d;
        const session = await repo.findSessionById(id);
        if (!session) throw sessionErrors.sessionNotFound();

        const range = { startDate: dto.startDate ? new Date(dto.startDate) : session.startDate, endDate: dto.endDate ? new Date(dto.endDate) : session.endDate };
        if (range.endDate.getTime() <= range.startDate.getTime()) throw sessionErrors.endBeforeStart();
        const others = (await repo.findAllSessions()).filter(s => s.id !== id);
        if (dto.name && others.some(s => sameName(s.name, dto.name!))) throw sessionErrors.sessionNameTaken();
        const clash = firstOverlap(range, others);
        if (clash) throw sessionErrors.sessionOverlap(clash.name);
        if ((session.terms ?? []).some(t => !rangeInside(t, range))) throw sessionErrors.sessionExcludesTerms();

        const data: Record<string, unknown> = {};
        const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
        if (dto.name && dto.name !== session.name) { data.name = dto.name; before.name = session.name; after.name = dto.name; }
        if (dto.startDate && day(range.startDate) !== day(session.startDate)) { data.startDate = range.startDate; before.startDate = day(session.startDate); after.startDate = day(range.startDate); }
        if (dto.endDate && day(range.endDate) !== day(session.endDate)) { data.endDate = range.endDate; before.endDate = day(session.endDate); after.endDate = day(range.endDate); }
        if (Object.keys(data).length === 0) return this.d.sessionMapper.toResponse(session);

        await repo.updateSession(id, data).catch(err => { throw isUniqueViolation(err) ? sessionErrors.sessionNameTaken() : err; });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "session.updated", entity: "Session", entityId: id, oldValue: before, newValue: after });
        return this.d.sessionMapper.toResponse((await repo.findSessionById(id))!);
    }
}

/* CREATE TERM. One of each name per session, inside the session's dates, not overlapping another term. */
export class CreateTermUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, dto: CreateTermDtoType, actor: SessionActor): Promise<TermResponseData> {
        const { sessionRepository: repo } = this.d;
        const session = await repo.findSessionById(dto.sessionId);
        if (!session) throw sessionErrors.sessionNotFound();
        const terms = session.terms ?? [];
        if (terms.some(t => t.name === dto.name)) throw sessionErrors.termNameTaken();
        const range = { startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) };
        if (!rangeInside(range, session)) throw sessionErrors.termOutsideSession();
        const clash = firstOverlap(range, terms);
        if (clash) throw sessionErrors.termOverlap(clash.name);

        const created = await repo.createTerm({ sessionId: dto.sessionId, name: dto.name, ...range }).catch(err => { throw isUniqueViolation(err) ? sessionErrors.termNameTaken() : err; });
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "term.created", entity: "Term", entityId: created.id, newValue: { session: session.name, name: dto.name, startDate: dto.startDate, endDate: dto.endDate } });
        return this.d.termMapper.toResponse(created, { id: session.id, name: session.name });
    }
}

/* UPDATE TERM. Only the dates can change (records are saved against the term). Same date rules as create. */
export class UpdateTermUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, id: string, dto: UpdateTermDtoType, actor: SessionActor): Promise<TermResponseData> {
        const { sessionRepository: repo } = this.d;
        const term = await repo.findTermById(id);
        if (!term) throw sessionErrors.termNotFound();
        const session = (await repo.findSessionById(term.sessionId))!;

        const range = { startDate: dto.startDate ? new Date(dto.startDate) : term.startDate, endDate: dto.endDate ? new Date(dto.endDate) : term.endDate };
        if (range.endDate.getTime() <= range.startDate.getTime()) throw sessionErrors.endBeforeStart();
        if (!rangeInside(range, session)) throw sessionErrors.termOutsideSession();
        const clash = firstOverlap(range, session.terms ?? [], id);
        if (clash) throw sessionErrors.termOverlap(clash.name);

        const data: Record<string, unknown> = {}, before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
        if (dto.startDate && day(range.startDate) !== day(term.startDate)) { data.startDate = range.startDate; before.startDate = day(term.startDate); after.startDate = day(range.startDate); }
        if (dto.endDate && day(range.endDate) !== day(term.endDate)) { data.endDate = range.endDate; before.endDate = day(term.endDate); after.endDate = day(range.endDate); }
        const ref = { id: session.id, name: session.name };
        if (Object.keys(data).length === 0) return this.d.termMapper.toResponse(term, ref);

        const updated = await repo.updateTerm(id, data);
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "term.updated", entity: "Term", entityId: id, oldValue: { session: session.name, term: term.name, ...before }, newValue: after });
        return this.d.termMapper.toResponse(updated, ref);
    }
}
