"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { usePlatformUsers, useDeactivatePlatformUser } from "@/features/super-admin/hooks/use-super-admin";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { ApiErrorResponse } from "@/types/api-response";

const ROLE_OPTIONS = ["school_admin", "principal", "teacher", "bursar", "student", "guardian", "super_admin"];

export default function AdminUsersPage() {
	const [search, setSearch] = useState("");
	const [role, setRole] = useState<string>("all");
	const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
	const debouncedSearch = useDebouncedValue(search, 400);

	const { data, isLoading } = usePlatformUsers({
		limit: 100,
		search: debouncedSearch || undefined,
		role: role === "all" ? undefined : role,
	});
	const deactivateUser = useDeactivatePlatformUser();

	async function handleDeactivate() {
		if (!deactivatingId) return;
		try {
			await deactivateUser.mutateAsync(deactivatingId);
			toast.success("User deactivated");
			setDeactivatingId(null);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't deactivate user");
		}
	}

	return (
		<>
			<PageHeader title="Users" description={`${data?.users.length ?? 0} users across all schools`} />

			<div className="mb-4 flex flex-wrap gap-2">
				<div className="relative max-w-sm flex-1">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
				</div>
				<Select value={role} onValueChange={(v) => setRole(v ?? "all")}>
					<SelectTrigger className="w-44">
						<SelectValue placeholder="All roles">
							{(value: string | null) => (value === "all" || !value ? "All roles" : value.replace("_", " "))}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All roles</SelectItem>
						{ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
					</SelectContent>
				</Select>
			</div>

			<div className="overflow-hidden rounded-xl border border-border bg-card/60">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">Name</th>
							<th className="px-4 py-3 text-left">Email</th>
							<th className="px-4 py-3 text-left">Role</th>
							<th className="px-4 py-3 text-left">Status</th>
							<th className="w-10" />
						</tr>
					</thead>
					<tbody>
						{isLoading &&
							Array.from({ length: 6 }).map((_, i) => (
								<tr key={i} className="border-t border-border"><td colSpan={5} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
							))}

						{data?.users.map((user) => (
							<tr key={user.id} className="border-t border-border hover:bg-muted/30">
								<td className="px-4 py-3 font-medium">{user.firstName} {user.lastName}</td>
								<td className="px-4 py-3 text-muted-foreground">{user.email}</td>
								<td className="px-4 py-3">
									<Badge variant="secondary" className="capitalize">{user.role.replace("_", " ")}</Badge>
								</td>
								<td className="px-4 py-3">
									<Badge variant={user.isActive ? "default" : "outline"}>{user.isActive ? "Active" : "Inactive"}</Badge>
								</td>
								<td className="px-2 py-3">
									{user.isActive && (
										<Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeactivatingId(user.id)}>
											Deactivate
										</Button>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<ConfirmDialog
				open={!!deactivatingId}
				onOpenChange={(open) => !open && setDeactivatingId(null)}
				title="Deactivate this user?"
				description="They will immediately lose access to the platform."
				confirmLabel="Deactivate"
				destructive
				isLoading={deactivateUser.isPending}
				onConfirm={handleDeactivate}
			/>
		</>
	);
}