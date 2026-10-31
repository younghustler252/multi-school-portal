import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { BandInput, ComponentInput } from "../domain/grades.policy";

/* Grades setup data access. `level` null = the default for all levels. */
export interface ScaleRow { id: string; name: string; level: string | null; bands: Array<{ minScore: number; grade: string; remark: string; isPass: boolean }> }
export interface SchemeRow { id: string; name: string; level: string | null; components: Array<{ name: string; kind: "ca" | "exam"; maxScore: number; position: number }> }

export class GradesSetupRepository {
    private get db() { return getTenantClient(); }

    scales(): Promise<ScaleRow[]> {
        return this.db.gradingScale.findMany({ include: { bands: { orderBy: { minScore: "desc" } } } }) as Promise<ScaleRow[]>;
    }
    schemes(): Promise<SchemeRow[]> {
        return this.db.assessmentScheme.findMany({ include: { components: { orderBy: { position: "asc" } } } }) as Promise<SchemeRow[]>;
    }

    /** Replace a level's whole scale in ONE transaction (the old bands are never removed on their own). */
    async saveScale(level: string | null, bands: BandInput[]): Promise<void> {
        await this.db.$transaction(async tx => {
            const existing = await tx.gradingScale.findFirst({ where: { level } });
            const scale = existing ?? await tx.gradingScale.create({ data: { name: level ? level.toUpperCase() : "Default", level } });
            await tx.gradingBand.deleteMany({ where: { scaleId: scale.id } });
            await tx.gradingBand.createMany({ data: bands.map(b => ({ scaleId: scale.id, minScore: b.minScore, grade: b.grade.trim(), remark: b.remark.trim(), isPass: b.isPass })) });
            await tx.gradingScale.update({ where: { id: scale.id }, data: { updatedAt: new Date() } });
        });
    }
    async deleteScale(level: string): Promise<boolean> {
        return (await this.db.gradingScale.deleteMany({ where: { level } })).count > 0;
    }

    async saveScheme(level: string | null, components: ComponentInput[]): Promise<void> {
        await this.db.$transaction(async tx => {
            const existing = await tx.assessmentScheme.findFirst({ where: { level } });
            const scheme = existing ?? await tx.assessmentScheme.create({ data: { name: level ? level.toUpperCase() : "Default", level } });
            await tx.assessmentComponent.deleteMany({ where: { schemeId: scheme.id } });
            await tx.assessmentComponent.createMany({ data: components.map((c, i) => ({ schemeId: scheme.id, name: c.name.trim(), kind: c.kind, maxScore: c.maxScore, position: i + 1 })) });
            await tx.assessmentScheme.update({ where: { id: scheme.id }, data: { updatedAt: new Date() } });
        });
    }
    async deleteScheme(level: string): Promise<boolean> {
        return (await this.db.assessmentScheme.deleteMany({ where: { level } })).count > 0;
    }
}
