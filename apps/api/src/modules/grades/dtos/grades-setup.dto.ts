import { z } from "zod";
import { LEVEL_KEYS, MAX_BANDS, MAX_COMPONENTS } from "../domain/grades.policy";

/* GRADES SETUP DTOs. Strict (unknown fields are rejected). The rules that need the whole list are in grades.policy. */
export const LevelParams = z.object({ level: z.enum(LEVEL_KEYS as unknown as [string, ...string[]]) });

const Band = z.object({
    minScore: z.number(),
    grade:    z.string().trim().min(1).max(10),
    remark:   z.string().trim().max(40),
    isPass:   z.boolean(),
}).strict();

const Component = z.object({
    name:     z.string().trim().min(1).max(30),
    kind:     z.enum(["ca", "exam"]),
    maxScore: z.number(),
}).strict();

export const SaveScaleDto  = z.object({ bands: z.array(Band).min(1).max(MAX_BANDS) }).strict();
export const SaveSchemeDto = z.object({ components: z.array(Component).min(1).max(MAX_COMPONENTS) }).strict();

export type SaveScaleDtoType  = z.infer<typeof SaveScaleDto>;
export type SaveSchemeDtoType = z.infer<typeof SaveSchemeDto>;
