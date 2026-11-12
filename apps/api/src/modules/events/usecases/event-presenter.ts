import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { CalendarEventEntity } from "../domain/event.entity";
import { NameRef } from "../mappers/event.mapper";

/* Looks up term and session NAMES for a list of events with ONE query (sessions come with their terms). */
export async function nameLookup(sessions: Pick<ISessionRepository, "findAllSessions">, events: CalendarEventEntity[]) {
    if (events.length === 0) return (_e: CalendarEventEntity) => ({ term: null as NameRef | null, session: null as NameRef | null });
    const all = await sessions.findAllSessions();
    const sessionRef = new Map<string, NameRef>(all.map(s => [s.id, { id: s.id, name: s.name }]));
    const termRef = new Map<string, NameRef & { sessionId: string }>(all.flatMap(s => (s.terms ?? []).map(t => [t.id, { id: t.id, name: t.name, sessionId: s.id }] as const)));
    return (e: CalendarEventEntity) => {
        const t = e.termId ? termRef.get(e.termId) : undefined;
        const sessionId = e.sessionId ?? t?.sessionId ?? null;
        return { term: t ? { id: t.id, name: t.name } : null, session: sessionId ? sessionRef.get(sessionId) ?? null : null };
    };
}
