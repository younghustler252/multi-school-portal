import { Prisma } from "../../../generated/prisma";
import { getTenantClient }       from "../../../infrastructure/database/prisma/prisma.client";
import { SessionMapper, TermMapper } from "../mappers/session.mapper";
import {
    SessionEntity,
    TermEntity,
}                                from "../domain/session.entity";
import { ISessionRepository }    from "./session.repository";

export class SessionRepositoryImpl implements ISessionRepository {
    private readonly sessionMapper: SessionMapper;
    private readonly termMapper:    TermMapper;

    private get db() { return getTenantClient(); }

    constructor({
        sessionMapper,
        termMapper,
    }: {
        sessionMapper: SessionMapper;
        termMapper:    TermMapper;
    }) {
        this.sessionMapper = sessionMapper;
        this.termMapper    = termMapper;
    }

    // ── Sessions ──────────────────────────────────────────────────────────
    async findSessionById(id: string): Promise<SessionEntity | null> {
        const raw = await this.db.session.findUnique({
            where:   { id },
            include: { terms: { orderBy: { startDate: "asc" } } },
        });
        return raw ? this.sessionMapper.toDomain(raw) : null;
    }

    async findAllSessions(): Promise<SessionEntity[]> {
        const raws = await this.db.session.findMany({
            orderBy: { startDate: "desc" },
            include: { terms: { orderBy: { startDate: "asc" } } },
        });
        return raws.map(r => this.sessionMapper.toDomain(r));
    }

    async findCurrentSession(): Promise<SessionEntity | null> {
        const raw = await this.db.session.findFirst({
            where:   { isCurrent: true },
            include: { terms: { orderBy: { startDate: "asc" } } },
        });
        return raw ? this.sessionMapper.toDomain(raw) : null;
    }

    async createSession(data: Prisma.SessionUncheckedCreateInput): Promise<SessionEntity> {
        const raw = await this.db.session.create({ data });
        return this.sessionMapper.toDomain(raw);
    }

    async updateSession(
        id:   string,
        data: Record<string, any>,
    ): Promise<SessionEntity> {
        const raw = await this.db.session.update({ where: { id }, data });
        return this.sessionMapper.toDomain(raw);
    }

    async setCurrentSession(id: string): Promise<SessionEntity> {
        // Unset all current sessions first
        await this.db.session.updateMany({
            where: { isCurrent: true },
            data:  { isCurrent: false },
        });

        // Set new current
        const raw = await this.db.session.update({
            where:   { id },
            data:    { isCurrent: true },
            include: { terms: true },
        });
        return this.sessionMapper.toDomain(raw);
    }

    // ── Terms ─────────────────────────────────────────────────────────────
    async findTermById(id: string): Promise<TermEntity | null> {
        const raw = await this.db.term.findUnique({ where: { id } });
        return raw ? this.termMapper.toDomain(raw) : null;
    }

    async findTermsBySession(sessionId: string): Promise<TermEntity[]> {
        const raws = await this.db.term.findMany({
            where:   { sessionId },
            orderBy: { startDate: "asc" },
        });
        return raws.map(r => this.termMapper.toDomain(r));
    }

    async findCurrentTerm(): Promise<TermEntity | null> {
        const raw = await this.db.term.findFirst({
            where: { isCurrent: true },
        });
        return raw ? this.termMapper.toDomain(raw) : null;
    }

    async createTerm(data: Prisma.TermUncheckedCreateInput): Promise<TermEntity> {
        const raw = await this.db.term.create({ data });
        return this.termMapper.toDomain(raw);
    }

    async updateTerm(
        id:   string,
        data: Record<string, any>,
    ): Promise<TermEntity> {
        const raw = await this.db.term.update({ where: { id }, data });
        return this.termMapper.toDomain(raw);
    }

    async setCurrentTerm(id: string): Promise<TermEntity> {
        // Unset all current terms first
        await this.db.term.updateMany({
            where: { isCurrent: true },
            data:  { isCurrent: false },
        });

        // Set new current
        const raw = await this.db.term.update({
            where: { id },
            data:  { isCurrent: true },
        });
        return this.termMapper.toDomain(raw);
    }
}