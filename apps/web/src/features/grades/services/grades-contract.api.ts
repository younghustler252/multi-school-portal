import { API, apiCall } from "@/lib/api/api-client";
import type { ApiResponse, PaginationMeta } from "@/types/api-response";
import type {
	GradeLevel, GradeResult, ListGradeResultsParams, ListSheetsParams, ReopenDto, SaveScaleDto, SaveSchemeDto,
	SaveScoresDto, SaveScoresResult, ScaleLevel, SchemeLevel, SheetAction, SheetDetail, SheetListItem, SheetTransitionResult,
} from "../types/sheet-contract.types";

export interface Paged<T> { data: T[]; meta: PaginationMeta | undefined }

/*
| Grades, as the backend now serves them (all under /grades; every body and query is strict).
|   GET  /sheets, /sheets/:classSubjectId           grades.view     list (paged) and one sheet with its `can` flags
|   PUT  /sheets/:classSubjectId/scores             grades.enter    partial saves are normal: see `skipped`
|   POST /sheets/:classSubjectId/{submit|approve|publish|lock}
|   POST /sheets/:classSubjectId/reopen             body { reason }
|   GET  /                                          results list; students and guardians see published rows only
|   GET/PUT/DELETE /scales[/:level], /schemes[/:level]
| The id in every sheet route is the ClassSubject id.
*/
async function paged<T>(url: string, params: object): Promise<Paged<T>> {
	const res = (await API.get(url, { params })) as ApiResponse<T[]>;
	if (!res.success) throw res;
	return { data: res.data, meta: res.meta };
}

const clean = <T extends object>(o: T): Partial<T> =>
	Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;

export const gradesContractApi = {
	listSheets: (p: ListSheetsParams = {}) => paged<SheetListItem>("/grades/sheets", clean(p)),

	sheet: (classSubjectId: string): Promise<SheetDetail> =>
		apiCall<SheetDetail>({ method: "GET", url: `/grades/sheets/${classSubjectId}` }),

	saveScores: (classSubjectId: string, dto: SaveScoresDto): Promise<SaveScoresResult> =>
		apiCall<SaveScoresResult>({ method: "PUT", url: `/grades/sheets/${classSubjectId}/scores`, data: dto }),

	transition: (classSubjectId: string, action: Exclude<SheetAction, "reopen">): Promise<SheetTransitionResult> =>
		apiCall<SheetTransitionResult>({ method: "POST", url: `/grades/sheets/${classSubjectId}/${action}` }),

	reopen: (classSubjectId: string, dto: ReopenDto): Promise<SheetTransitionResult> =>
		apiCall<SheetTransitionResult>({ method: "POST", url: `/grades/sheets/${classSubjectId}/reopen`, data: dto }),

	results: (p: ListGradeResultsParams = {}) => paged<GradeResult>("/grades", clean(p)),

	scales: (): Promise<{ levels: ScaleLevel[] }> => apiCall({ method: "GET", url: "/grades/scales" }),
	schemes: (): Promise<{ levels: SchemeLevel[] }> => apiCall({ method: "GET", url: "/grades/schemes" }),
	saveScale: (level: GradeLevel, dto: SaveScaleDto) => apiCall({ method: "PUT", url: `/grades/scales/${level}`, data: dto }),
	saveScheme: (level: GradeLevel, dto: SaveSchemeDto) => apiCall({ method: "PUT", url: `/grades/schemes/${level}`, data: dto }),
	removeScale: (level: Exclude<GradeLevel, "default">) => apiCall({ method: "DELETE", url: `/grades/scales/${level}` }),
	removeScheme: (level: Exclude<GradeLevel, "default">) => apiCall({ method: "DELETE", url: `/grades/schemes/${level}` }),
};
