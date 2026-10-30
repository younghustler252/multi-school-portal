import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../audit/services/audit.service";
import { ISessionRepository } from "../repositories/session.repository";
import { SessionMapper, TermMapper, SessionResponseData, TermResponseData } from "../mappers/session.mapper";
import { sessionErrors } from "../domain/session.errors";
import { SessionActor } from "../domain/session.types";
import { SetCurrentTermDtoType } from "../dtos/session.dto";
import { rolloverInTx, RolloverResult } from "../services/term-rollover";

interface Dependencies { sessionRepository: ISessionRepository; sessionMapper: SessionMapper; termMapper: TermMapper; auditService: AuditService }

/*
| SET CURRENT SESSION. One transaction (never "no current session"). If the current term belongs to another
| session it is cleared, so the school then chooses a term of the new session.
*/
export class SetCurrentSessionUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, id: string, actor: SessionActor): Promise<SessionResponseData> {
        const { sessionRepository: repo } = this.d;
        const session = await repo.findSessionById(id);
        if (!session) throw sessionErrors.sessionNotFound();
        if (session.isCurrent) return this.d.sessionMapper.toResponse(session);

        const previous = await repo.findCurrentSession();
        const updated = await repo.setCurrentSession(id);
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "session.set_current", entity: "Session", entityId: id, oldValue: { current: previous?.name ?? null }, newValue: { current: session.name } });
        return this.d.sessionMapper.toResponse(updated);
    }
}

export interface SetCurrentTermResult { term: TermResponseData; rollover: RolloverResult | null }

/*
| SET CURRENT TERM (also makes its session current), in ONE transaction:
|   1. the term (and its session) become current, the old ones stop being current
|   2. unless carryForward is false: last term's students and subject teachers are carried into this term
|      (set-based, a few queries for the whole school; see services/term-rollover.ts)
| If anything fails nothing changes. Running it again on the current term only repeats step 2 and skips
| everything already there, so it is also the way to "carry forward again" after adding classes.
*/
export class SetCurrentTermUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string, id: string, dto: SetCurrentTermDtoType, actor: SessionActor): Promise<SetCurrentTermResult> {
        const { sessionRepository: repo, termMapper } = this.d;
        const term = await repo.findTermById(id);
        if (!term) throw sessionErrors.termNotFound();
        const session = (await repo.findSessionById(term.sessionId))!;
        const previousCurrent = await repo.findCurrentTerm();
        const previousTerm = await repo.findPreviousTermInSession(term.sessionId, term.id);

        let rollover: RolloverResult | null = null;
        await getTenantClient().$transaction(async tx => {
            await tx.term.updateMany({ where: { isCurrent: true, NOT: { id } }, data: { isCurrent: false } });
            await tx.session.updateMany({ where: { isCurrent: true, NOT: { id: term.sessionId } }, data: { isCurrent: false } });
            await tx.session.update({ where: { id: term.sessionId }, data: { isCurrent: true } });
            await tx.term.update({ where: { id }, data: { isCurrent: true } });
            if (dto.carryForward) rollover = await rolloverInTx(tx as any, previousTerm?.id ?? null, id);
        }, { maxWait: 5000, timeout: 30000 });

        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "term.set_current", entity: "Term", entityId: id,
            oldValue: { current: previousCurrent ? previousCurrent.name : null },
            newValue: { session: session.name, term: term.name, carryForward: dto.carryForward, ...(rollover ?? {}) },
        });
        const fresh = (await repo.findTermById(id))!;
        return { term: termMapper.toResponse(fresh, { id: session.id, name: session.name }), rollover };
    }
}
