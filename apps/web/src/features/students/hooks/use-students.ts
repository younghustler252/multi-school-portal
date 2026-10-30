import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentApi } from "../services/student.api";
import { CreateStudentDto, UpdateStudentDto, ListStudentsParams, StudentResponseData } from "../types/student.types";
import { PaginationMeta } from "@/types/api-response";

export function useStudents(params: ListStudentsParams) {
	return useQuery({
		queryKey: ["students", params],
		queryFn: async () => {
			const res = await studentApi.list(params);
			if (!res.success) throw res;
			return { students: res.data, meta: res.meta as PaginationMeta };
		},
	});
}

export function useStudent(id: string) {
	return useQuery({
		queryKey: ["students", id],
		queryFn: async () => {
			const res = await studentApi.getById(id);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: !!id,
	});
}

export function useCreateStudent() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateStudentDto) => {
			const res = await studentApi.create(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["students"] });
		},
	});
}

export function useUpdateStudent(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: UpdateStudentDto) => {
			const res = await studentApi.update(id, data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: (data) => {
			queryClient.setQueryData(["students", id], data);
			queryClient.invalidateQueries({ queryKey: ["students"], exact: false });
		},
	});
}

export function useDeactivateStudent() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const res = await studentApi.deactivate(id);
			if (!res.success) throw res;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["students"] });
		},
	});
}

export function useUploadStudentPhoto(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (file: File) => {
			const res = await studentApi.uploadPhoto(id, file);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: (data) => {
			queryClient.setQueryData<StudentResponseData | undefined>(["students", id], (old) =>
				old ? { ...old, photoUrl: data.url } : old
			);
		},
	});

}


export function usePatchStudentPhoto() {
	const queryClient = useQueryClient();
	return (id: string, photoUrl: string) => {
		queryClient.setQueryData<StudentResponseData | undefined>(["students", id], (old) =>
			old ? { ...old, photoUrl } : old
		);
	};
}

export function useStudentsBatch(ids: string[]) {
	return useQuery({
		queryKey: ["students", "batch", ids],
		queryFn: async () => {
			if (ids.length === 0) return [];
			const res = await studentApi.batch(ids);
			if (!res.success) throw res;
			return res.data;
		},
		enabled: ids.length > 0,
	});
}