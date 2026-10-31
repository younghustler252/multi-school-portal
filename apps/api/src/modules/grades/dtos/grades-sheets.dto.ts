import { z } from "zod";
import { MAX_SCORE_ENTRIES, REOPEN_REASON_MIN, SHEET_STATUSES } from "../domain/sheet.policy";

/* MARK SHEET DTOs. Strict (unknown fields are rejected). Rules that need the sheet's parts are in sheet.policy. */
const id = z.string().uuid();

export const SheetParams = z.object({ classSubjectId: id });

const Score = z.object({
    position: z.number().int().min(1).max(8),
    score:    z.number().nullable().optional(),    // empty = clear this part (back to "not entered")
    absent:   z.boolean().optional(),
}).strict();

export const SaveScoresDto = z.object({
    entries: z.array(z.object({ studentId: id, scores: z.array(Score).min(1).max(8) }).strict()).min(1).max(MAX_SCORE_ENTRIES),
}).strict();

export const ReopenDto = z.object({ reason: z.string().trim().min(REOPEN_REASON_MIN, `Please say why (at least ${REOPEN_REASON_MIN} characters)`).max(500) }).strict();

export const ListSheetsQuery = z.object({
    page:      z.coerce.number().int().min(1).default(1),
    limit:     z.coerce.number().int().min(1).max(100).default(20),
    termId:    id.optional(),                      // default: the current term
    classId:   id.optional(),
    subjectId: id.optional(),
    status:    z.enum(SHEET_STATUSES).optional(),
});

export const ListGradesQuery = z.object({
    page:      z.coerce.number().int().min(1).default(1),
    limit:     z.coerce.number().int().min(1).max(100).default(20),
    studentId: id.optional(),
    classId:   id.optional(),
    subjectId: id.optional(),
    termId:    id.optional(),
});

export type SaveScoresDtoType  = z.infer<typeof SaveScoresDto>;
export type ReopenDtoType      = z.infer<typeof ReopenDto>;
export type ListSheetsQueryType = z.infer<typeof ListSheetsQuery>;
export type ListGradesQueryType = z.infer<typeof ListGradesQuery>;
