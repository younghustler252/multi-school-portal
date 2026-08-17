import { useQuery } from "@tanstack/react-query";
import { guardianPortalApi } from "../services/guardian-portal.api";
import { MyChildrenParams, MyChildrenInvoicesParams } from "../types/guardian-portal.types";

export function useMyChildren() {
	return useQuery({
		queryKey: ["guardian-portal", "children"],
		queryFn: async () => {
			const res = await guardianPortalApi.getMyChildren();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useMyChildrenGrades(params: MyChildrenParams) {
	return useQuery({
		queryKey: ["guardian-portal", "grades", params],
		queryFn: async () => {
			const res = await guardianPortalApi.getMyChildrenGrades(params);
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useMyChildrenAttendance(params: MyChildrenParams) {
	return useQuery({
		queryKey: ["guardian-portal", "attendance", params],
		queryFn: async () => {
			const res = await guardianPortalApi.getMyChildrenAttendance(params);
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useMyChildrenInvoices(params: MyChildrenInvoicesParams) {
	return useQuery({
		queryKey: ["guardian-portal", "invoices", params],
		queryFn: async () => {
			const res = await guardianPortalApi.getMyChildrenInvoices(params);
			if (!res.success) throw res;
			return { invoices: res.data, meta: res.meta };
		},
	});
}