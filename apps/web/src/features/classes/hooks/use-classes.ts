import {
	useQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

import { classApi } from "../services/class.api";

import {
	CreateClassDto,
	UpdateClassDto,
	CreateSubjectDto,
	AssignSubjectDto,
	BulkAssignSubjectsDto,
	SetClassProgressionDto,
	ApplyTeachingDefaultsDto,
} from "../types/class.types";

export function useClasses(termId?: string) {
	return useQuery({
		queryKey: ["classes", termId],
		queryFn: async () => {
			const res = await classApi.list(termId);
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
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["classes"],
			});
		},
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
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["classes"],
			});
		},
	});
}

export function useDeleteClass() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			const res = await classApi.delete(id);
			if (!res.success) throw res;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["classes"],
			});
		},
	});
}

export function useClassSubjects(
	classId: string,
	termId: string | undefined,
) {
	return useQuery({
		queryKey: ["classes", classId, "subjects", termId],

		queryFn: async () => {
			const res = await classApi.getClassSubjects(
				classId,
				termId!,
			);

			if (!res.success) throw res;

			return res.data;
		},

		enabled: !!classId && !!termId,
	});
}
// use-classes.ts — patch signature
export function useAssignSubject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ classId, data }: { classId: string; data: AssignSubjectDto }) =>
			classApi.assignSubject(classId, data),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["classes", variables.classId, "subjects"] });
		},
	});
}
export function useClearSubjectOverride(classId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (classSubjectId: string) => {
			const res = await classApi.clearSubjectOverride(
				classId,
				classSubjectId,
			);

			if (!res.success) throw res;

			return res.data;
		},

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["classes", classId, "subjects"],
			});
		},
	});
}

export function useRemoveSubject(classId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (classSubjectId: string) => {
			const res = await classApi.removeSubject(
				classId,
				classSubjectId,
			);

			if (!res.success) throw res;
		},

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["classes", classId, "subjects"],
			});
		},
	});
}

export function useApplyTeachingDefaults() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => classApi.applyTeachingDefaults(),
		onSuccess: () => {
			// school-wide action — invalidate every class's subjects, not just one
			queryClient.invalidateQueries({ queryKey: ["classes"] });
		},
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

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["subjects"],
			});
		},
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

export function useSetClassProgression() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string;
			data: SetClassProgressionDto;
		}) => classApi.setProgression(id, data),

		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["classes"],
			});

			queryClient.invalidateQueries({
				queryKey: ["classes", variables.id],
			});
		},
	});
}

export function useBulkAssignSubjects() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			classId,
			data,
		}: {
			classId: string;
			data: BulkAssignSubjectsDto;
		}) =>
			classApi.bulkAssignSubjects(
				classId,
				data,
			),

		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["classes", variables.classId],
			});

			queryClient.invalidateQueries({
				queryKey: [
					"classes",
					variables.classId,
					"subjects",
				],
			});
		},
	});
}

export function useSetSubjectDefaultTeacher() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ subjectId, staffId }: { subjectId: string; staffId: string | null }) =>
			classApi.setSubjectDefaultTeacher(subjectId, staffId),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
	});
}