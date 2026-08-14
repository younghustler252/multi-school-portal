"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffCard } from "@/features/staff/components/staff-card";
import { RoleFilterPills } from "@/features/staff/components/role-filter-pills";
import { useStaffList, useDeactivateStaff } from "@/features/staff/hooks/use-staff";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { StaffRole } from "@/features/staff/types/staff.types";
import { ApiErrorResponse } from "@/types/api-response";

export default function StaffPage() {
	const [search, setSearch] = useState("");
	const [role, setRole] = useState<StaffRole | "all">("all");
	const debouncedSearch = useDebouncedValue(search, 400);
	const deactivateStaff = useDeactivateStaff();

	const { data, isLoading } = useStaffList({
		limit: 100,
		search: debouncedSearch || undefined,
		role: role === "all" ? undefined : role,
	});

	async function handleToggleStatus(id: string) {
		try {
			await deactivateStaff.mutateAsync(id);
			toast.success("Status updated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update status");
		}
	}

	const activeCount = data?.staff.filter((s) => s.isActive).length ?? 0;

	return (
		<>
			<PageHeader
				title="Staff"
				description={`${activeCount} active staff member${activeCount === 1 ? "" : "s"}`}
				actions={
					<Button nativeButton={false} render={<Link href="/school-admin/staff/new"><Plus className="size-4" /> Add staff</Link>} />
				}
			/>

			<div className="mb-4 space-y-3">
				<div className="relative max-w-sm">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search by name or email…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>
				<RoleFilterPills value={role} onChange={setRole} />
			</div>

			{isLoading && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
				</div>
			)}

			{!isLoading && data?.staff.length === 0 && (
				<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
					No staff found.
				</div>
			)}

			{data && data.staff.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{data.staff.map((s) => (
						<StaffCard key={s.id} staff={s} />
					))}
				</div>
			)}
		</>
	);
}