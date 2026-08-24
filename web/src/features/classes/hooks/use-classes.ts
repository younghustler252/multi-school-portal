import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { classApi } from "../services/class.api";
import { CreateClassDto, UpdateClassDto, CreateSubjectDto, AssignSubjectDto } from "../types/class.types";

export function useClasses() {
	return useQuery({
		queryKey: ["classes"],
		queryFn: async () => {
			const res = await classApi.list();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useCreateClass() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateClassDto) => {
			const res = await classApi.create(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classes"] }),
	});
}

export function useUpdateClass(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: UpdateClassDto) => {
			const res = await classApi.update(id, data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classes"] }),
	});
}

export function useDeleteClass() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const res = await classApi.delete(id);
			if (!res.success) throw res;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classes"] }),
	});
}

export function useClassSubjects(classId: string) {
	return useQuery({
		queryKey: ["classes", classId, "subjects"],
		queryFn: async () => {
			const res = await classApi.getClassSubjects(classId);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!classId,
	});
}

export function useAssignSubject(classId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: AssignSubjectDto) => {
			const res = await classApi.assignSubject(classId, data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classes", classId, "subjects"] }),
	});
}

export function useRemoveSubject(classId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (classSubjectId: string) => {
			const res = await classApi.removeSubject(classId, classSubjectId);
			if (!res.success) throw res;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["classes", classId, "subjects"] }),
	});
}

export function useSubjects() {
	return useQuery({
		queryKey: ["subjects"],
		queryFn: async () => {
			const res = await classApi.listSubjects();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useCreateSubject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateSubjectDto) => {
			const res = await classApi.createSubject(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
	});
}

export function useClass(id: string) {
	return useQuery({
		queryKey: ["classes", id],
		queryFn: async () => {
			const res = await classApi.getById(id);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!id,
	});
}