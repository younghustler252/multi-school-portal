import { Prisma } from "../../../generated/tenant";
import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { SessionMapper, TermMapper } from "../mappers/session.mapper";
import { SessionEntity, TermEntity } from "../domain/session.entity";
import { ISessionRepository } from "./session.repository";

export class SessionRepositoryImpl
    extends BaseTenantRepository<SessionEntity>
    implements ISessionRepository
{
    protected readonly modelName = "session";
    private readonly termMapper: TermMapper;

    constructor({
        sessionMapper,
        termMapper,
    }: {
        sessionMapper: SessionMapper;
        termMapper: TermMapper;
    }) {
        super(sessionMapper);
        this.termMapper = termMapper;
    }

    async findSessionById(id: string): Promise<SessionEntity | null> {
        return this.findById(id, { terms: { orderBy: { startDate: "asc" } } });
    }

    async findAllSessions(): Promise<SessionEntity[]> {
        return this.findMany(
            {},
            { terms: { orderBy: { startDate: "asc" } } },
            { startDate: "desc" },
        );
    }

    async findCurrentSession(): Promise<SessionEntity | null> {
        return this.findOne(
            { isCurrent: true },
            { terms: { orderBy: { startDate: "asc" } } },
        );
    }

    async createSession(data: Prisma.SessionUncheckedCreateInput): Promise<SessionEntity> {
        return this.create(data);
    }

    async updateSession(id: string, data: Record<string, any>): Promise<SessionEntity> {
        return this.update(id, data);
    }

    /** Makes one session current. The old one is cleared in the SAME transaction, so there is never no current session. */
    async setCurrentSession(id: string): Promise<SessionEntity> {
        await this.prisma.$transaction(async tx => {
            await tx.session.updateMany({ where: { isCurrent: true, NOT: { id } }, data: { isCurrent: false } });
            await tx.session.update({ where: { id }, data: { isCurrent: true } });
            // a current term must belong to the current session
            await tx.term.updateMany({ where: { isCurrent: true, NOT: { sessionId: id } }, data: { isCurrent: false } });
        });
        return (await this.findSessionById(id))!;
    }

    async findTermById(id: string): Promise<TermEntity | null> {
        const raw = await this.prisma.term.findUnique({ where: { id } });
        return raw ? this.termMapper.toDomain(raw) : null;
    }

    async findTermsBySession(sessionId: string): Promise<TermEntity[]> {
        const raws = await this.prisma.term.findMany({
            where: { sessionId },
            orderBy: { startDate: "asc" },
        });
        return raws.map(r => this.termMapper.toDomain(r));
    }

    async findCurrentTerm(): Promise<TermEntity | null> {
        const raw = await this.prisma.term.findFirst({ where: { isCurrent: true } });
        return raw ? this.termMapper.toDomain(raw) : null;
    }

    async createTerm(data: Prisma.TermUncheckedCreateInput): Promise<TermEntity> {
        const raw = await this.prisma.term.create({ data });
        return this.termMapper.toDomain(raw);
    }

    async updateTerm(id: string, data: Record<string, any>): Promise<TermEntity> {
        const raw = await this.prisma.term.update({ where: { id }, data });
        return this.termMapper.toDomain(raw);
    }

    /** Makes one term current (and its session current too) in ONE transaction. */
    async setCurrentTerm(id: string): Promise<TermEntity> {
        const raw = await this.prisma.$transaction(async tx => {
            const term = await tx.term.findUniqueOrThrow({ where: { id } });
            await tx.term.updateMany({ where: { isCurrent: true, NOT: { id } }, data: { isCurrent: false } });
            await tx.session.updateMany({ where: { isCurrent: true, NOT: { id: term.sessionId } }, data: { isCurrent: false } });
            await tx.session.update({ where: { id: term.sessionId }, data: { isCurrent: true } });
            return tx.term.update({ where: { id }, data: { isCurrent: true } });
        });
        return this.termMapper.toDomain(raw);
    }
    async findPreviousTermInSession(
        sessionId: string,
        currentTermId: string,
    ): Promise<TermEntity | null> {
        const currentTerm = await this.prisma.term.findUnique({
            where: { id: currentTermId },
            select: { startDate: true },
        });

        if (!currentTerm) return null;

        const raw = await this.prisma.term.findFirst({
            where: {
                sessionId,
                id: { not: currentTermId },
                startDate: { lt: currentTerm.startDate },
            },
            orderBy: {
                startDate: "desc",
            },
        });

        return raw ? this.termMapper.toDomain(raw) : null;
    }

}