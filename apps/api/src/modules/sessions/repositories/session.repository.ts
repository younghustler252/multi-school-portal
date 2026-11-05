import type { RolloverResult } from "../services/term-rollover";
import {
    SessionEntity,
    TermEntity,
}                        from "../domain/session.entity";

export interface ISessionRepository {
    // ── Sessions ──────────────────────────────────────────────────────────
    findSessionById(id: string):                     Promise<SessionEntity | null>;
    findAllSessions():                               Promise<SessionEntity[]>;
    findCurrentSession():                            Promise<SessionEntity | null>;
    createSession(data: Record<string, any>):        Promise<SessionEntity>;
    updateSession(
        id:   string,
        data: Record<string, any>,
    ):                                               Promise<SessionEntity>;
    setCurrentSession(id: string):                   Promise<SessionEntity>;

    // ── Terms ─────────────────────────────────────────────────────────────
    findTermById(id: string):                        Promise<TermEntity | null>;
    findTermsBySession(sessionId: string):           Promise<TermEntity[]>;
    findCurrentTerm():                               Promise<TermEntity | null>;
    createTerm(data: Record<string, any>):           Promise<TermEntity>;
    updateTerm(
        id:   string,
        data: Record<string, any>,
    ):                                               Promise<TermEntity>;
    setCurrentTerm(id: string):                      Promise<TermEntity>;
    findPreviousTermInSession(
        sessionId:      string,
        currentTermId:  string,
    ):                                                  Promise<TermEntity | null>;

    /** Makes the term (and its session) current and, when `carryForward`, rolls last term's students and teachers in: ONE transaction. */
    makeTermCurrent(termId: string, sessionId: string, previousTermId: string | null, carryForward: boolean): Promise<RolloverResult | null>;
}
