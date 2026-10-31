import { AuditService } from "../../audit/services/audit.service";
import { GradesSetupRepository, ScaleRow, SchemeRow } from "../repositories/grades-setup.repository";
import { gradesErrors } from "../domain/grades.errors";
import { GRADE_LEVELS, LevelKey, isLevelKey, validateBands, validateComponents } from "../domain/grades.policy";
import { SaveScaleDtoType, SaveSchemeDtoType } from "../dtos/grades-setup.dto";

interface Dependencies { gradesSetupRepository: GradesSetupRepository; auditService: AuditService }
export interface GradesActor { userId: string }

const levelOf = (key: string): string | null => {
    if (!isLevelKey(key)) throw gradesErrors.levelInvalid();
    return key === "default" ? null : key;
};
const ALL_LEVELS: LevelKey[] = ["default", ...GRADE_LEVELS];

/* A band runs up to the next band's start; the top band reaches 100. `upTo` is that next start (exclusive), null for the top. */
const bandsView = (bands: ScaleRow["bands"]) => {
    const asc = [...bands].sort((a, b) => a.minScore - b.minScore);
    return asc.map((b, i) => ({ minScore: b.minScore, upTo: asc[i + 1]?.minScore ?? null, grade: b.grade, remark: b.remark, isPass: b.isPass })).reverse();
};
const describeBands = (bands: ScaleRow["bands"]) => bandsView(bands).map(b => `${b.grade} from ${b.minScore}${b.isPass ? "" : " (fail)"}`);
const describeParts = (cs: SchemeRow["components"]) => cs.map(c => `${c.name} ${c.maxScore} (${c.kind})`);

/* Every level, with the scale it really uses: its own, or the default's. */
export class ListScalesUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute() {
        const rows = await this.d.gradesSetupRepository.scales();
        const own = new Map(rows.map(r => [r.level ?? "default", r]));
        const def = own.get("default");
        return { levels: ALL_LEVELS.map(level => {
            const scale = own.get(level) ?? def;
            return { level, usesDefault: level !== "default" && !own.has(level), scale: scale ? { id: scale.id, name: scale.name, bands: bandsView(scale.bands) } : null };
        }) };
    }
}

export class SaveScaleUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, levelKey: string, dto: SaveScaleDtoType, actor: GradesActor) {
        const level = levelOf(levelKey);
        const problems = validateBands(dto.bands);
        if (problems.length) throw gradesErrors.scaleInvalid(problems);
        const before = (await this.d.gradesSetupRepository.scales()).find(s => s.level === level);
        await this.d.gradesSetupRepository.saveScale(level, dto.bands);
        const after = (await this.d.gradesSetupRepository.scales()).find(s => s.level === level)!;
        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "grades.scale_updated", entity: "GradingScale", entityId: after.id,
            oldValue: { level: levelKey, bands: before ? describeBands(before.bands) : null }, newValue: { level: levelKey, bands: describeBands(after.bands) },
        });
        return new ListScalesUseCase(this.d).execute();
    }
}

export class DeleteScaleUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, levelKey: string, actor: GradesActor) {
        const level = levelOf(levelKey);
        if (!level) throw gradesErrors.defaultRequired("grading scale");
        const before = (await this.d.gradesSetupRepository.scales()).find(s => s.level === level);
        if (!before) throw gradesErrors.notFound("Grading scale");
        await this.d.gradesSetupRepository.deleteScale(level);
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "grades.scale_removed", entity: "GradingScale", entityId: before.id, oldValue: { level: levelKey, bands: describeBands(before.bands) }, newValue: { usesDefault: true } });
        return new ListScalesUseCase(this.d).execute();
    }
}

export class ListSchemesUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute() {
        const rows = await this.d.gradesSetupRepository.schemes();
        const own = new Map(rows.map(r => [r.level ?? "default", r]));
        const def = own.get("default");
        return { levels: ALL_LEVELS.map(level => {
            const scheme = own.get(level) ?? def;
            return { level, usesDefault: level !== "default" && !own.has(level),
                scheme: scheme ? { id: scheme.id, name: scheme.name, total: scheme.components.reduce((n, c) => n + c.maxScore, 0), components: scheme.components.map(c => ({ name: c.name, kind: c.kind, maxScore: c.maxScore, position: c.position })) } : null };
        }) };
    }
}

export class SaveSchemeUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, levelKey: string, dto: SaveSchemeDtoType, actor: GradesActor) {
        const level = levelOf(levelKey);
        const problems = validateComponents(dto.components);
        if (problems.length) throw gradesErrors.schemeInvalid(problems);
        const before = (await this.d.gradesSetupRepository.schemes()).find(s => s.level === level);
        await this.d.gradesSetupRepository.saveScheme(level, dto.components);
        const after = (await this.d.gradesSetupRepository.schemes()).find(s => s.level === level)!;
        await this.d.auditService.log({
            userId: actor.userId, schoolId, action: "grades.scheme_updated", entity: "AssessmentScheme", entityId: after.id,
            oldValue: { level: levelKey, parts: before ? describeParts(before.components) : null }, newValue: { level: levelKey, parts: describeParts(after.components) },
        });
        return new ListSchemesUseCase(this.d).execute();
    }
}

export class DeleteSchemeUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, levelKey: string, actor: GradesActor) {
        const level = levelOf(levelKey);
        if (!level) throw gradesErrors.defaultRequired("assessment scheme");
        const before = (await this.d.gradesSetupRepository.schemes()).find(s => s.level === level);
        if (!before) throw gradesErrors.notFound("Assessment scheme");
        await this.d.gradesSetupRepository.deleteScheme(level);
        await this.d.auditService.log({ userId: actor.userId, schoolId, action: "grades.scheme_removed", entity: "AssessmentScheme", entityId: before.id, oldValue: { level: levelKey, parts: describeParts(before.components) }, newValue: { usesDefault: true } });
        return new ListSchemesUseCase(this.d).execute();
    }
}
