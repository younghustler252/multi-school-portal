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

    async setCurrentSession(id: string): Promise<SessionEntity> {
        await this.model().updateMany({
            where: { isCurrent: true },
            data: { isCurrent: false },
        });

        return this.update(id, { isCurrent: true }, { terms: true });
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

    async setCurrentTerm(id: string): Promise<TermEntity> {
        await this.prisma.term.updateMany({
            where: { isCurrent: true },
            data: { isCurrent: false },
        });

        const raw = await this.prisma.term.update({
            where: { id },
            data: { isCurrent: true },
        });
        return this.termMapper.toDomain(raw);
    }
}