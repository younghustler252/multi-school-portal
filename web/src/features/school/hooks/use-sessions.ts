import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionApi } from "../services/session.api";
import { CreateSessionDto, CreateTermDto, UpdateTermDto } from "../types/session.types";

export function useSessions() {
	return useQuery({
		queryKey: ["sessions"],
		queryFn: async () => {
			const res = await sessionApi.list();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useCurrentSession() {
	return useQuery({
		queryKey: ["sessions", "current"],
		queryFn: async () => {
			const res = await sessionApi.getCurrent();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useCreateSession() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateSessionDto) => {
			const res = await sessionApi.create(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
	});
}

export function useSetCurrentSession() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const res = await sessionApi.setCurrent(id);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sessions"] });
			queryClient.invalidateQueries({ queryKey: ["sessions", "current"] });
		},
	});
}

export function useCreateTerm() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateTermDto) => {
			const res = await sessionApi.createTerm(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
	});
}

export function useSetCurrentTerm() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (termId: string) => {
			const res = await sessionApi.setCurrentTerm(termId);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sessions"] });
			queryClient.invalidateQueries({ queryKey: ["sessions", "current"] });
		},
	});
}