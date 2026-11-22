import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gradesContractApi } from "../services/grades-contract.api";
import type {
	GradeLevel, ListGradeResultsParams, ListSheetsParams, ReopenDto, SaveScaleDto, SaveSchemeDto, SaveScoresDto, SheetAction,
} from "../types/sheet-contract.types";

export const gradeKeys = {
	all: ["grades"] as const,
	sheets: (p: ListSheetsParams) => ["grades", "sheets", p] as const,
	sheet: (id: string) => ["grades", "sheet", id] as const,
	results: (p: ListGradeResultsParams) => ["grades", "results", p] as const,
	scales: () => ["grades", "scales"] as const,
	schemes: () => ["grades", "schemes"] as const,
};

export function useSheetList(params: ListSheetsParams, enabled = true) {
	return useQuery({ queryKey: gradeKeys.sheets(params), queryFn: () => gradesContractApi.listSheets(params), enabled, placeholderData: keepPreviousData });
}

export function useSheet(classSubjectId: string | undefined) {
	return useQuery({ queryKey: gradeKeys.sheet(classSubjectId ?? ""), queryFn: () => gradesContractApi.sheet(classSubjectId!), enabled: !!classSubjectId });
}

export function useGradeResults(params: ListGradeResultsParams, enabled = true) {
	return useQuery({ queryKey: gradeKeys.results(params), queryFn: () => gradesContractApi.results(params), enabled, placeholderData: keepPreviousData });
}

/** Every change to a sheet can alter its list row, its detail and any report built on it. */
function useRefreshSheets() {
	const qc = useQueryClient();
	return (classSubjectId: string) => Promise.all([
		qc.invalidateQueries({ queryKey: gradeKeys.sheet(classSubjectId) }),
		qc.invalidateQueries({ queryKey: ["grades", "sheets"] }),
		qc.invalidateQueries({ queryKey: ["grades", "results"] }),
	]);
}

export function useSaveScores(classSubjectId: string) {
	const refresh = useRefreshSheets();
	return useMutation({ mutationFn: (dto: SaveScoresDto) => gradesContractApi.saveScores(classSubjectId, dto), onSuccess: () => refresh(classSubjectId) });
}

export function useSheetTransition(classSubjectId: string) {
	const refresh = useRefreshSheets();
	return useMutation({ mutationFn: (action: Exclude<SheetAction, "reopen">) => gradesContractApi.transition(classSubjectId, action), onSuccess: () => refresh(classSubjectId) });
}

export function useReopenSheet(classSubjectId: string) {
	const refresh = useRefreshSheets();
	return useMutation({ mutationFn: (dto: ReopenDto) => gradesContractApi.reopen(classSubjectId, dto), onSuccess: () => refresh(classSubjectId) });
}

export function useGradeScales() {
	return useQuery({ queryKey: gradeKeys.scales(), queryFn: gradesContractApi.scales });
}
export function useGradeSchemes() {
	return useQuery({ queryKey: gradeKeys.schemes(), queryFn: gradesContractApi.schemes });
}

export function useSaveScale() {
	const qc = useQueryClient();
	return useMutation({ mutationFn: (v: { level: GradeLevel; dto: SaveScaleDto }) => gradesContractApi.saveScale(v.level, v.dto), onSuccess: () => qc.invalidateQueries({ queryKey: gradeKeys.scales() }) });
}
export function useSaveScheme() {
	const qc = useQueryClient();
	return useMutation({ mutationFn: (v: { level: GradeLevel; dto: SaveSchemeDto }) => gradesContractApi.saveScheme(v.level, v.dto), onSuccess: () => qc.invalidateQueries({ queryKey: gradeKeys.schemes() }) });
}
