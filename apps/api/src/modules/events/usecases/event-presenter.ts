import { ISessionRepository } from "../../sessions/repositories/session.repository";
import { CalendarEventEntity } from "../domain/event.entity";
import { ManagerExtras, NameRef } from "../mappers/event.mapper";
import type { IEventRepository } from "../repositories/event.repository";

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

/* What only managers see: whether the publish notice went out, and how this revision's reminders stand. One query for all the events. */
export async function managerExtras(repo: Pick<IEventRepository, "listRemindersFor">, events: CalendarEventEntity[]) {
    const rows = await repo.listRemindersFor(events.map(e => e.id));
    return (e: CalendarEventEntity): ManagerExtras => {
        const counts = { pending: 0, sent: 0, skipped: 0, failed: 0, cancelled: 0 };
        for (const r of rows) if (r.eventId === e.id && r.revision === e.revision) { const k = r.status.toLowerCase(); if (k in counts) counts[k as keyof typeof counts]++; else if (k === "processing") counts.pending++; }
        return { publishNoticeSentAt: e.publishNoticeSentAt, reminders: counts };
    };
}
