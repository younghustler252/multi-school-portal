"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Phone, MoreHorizontal, Eye, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StaffResponseData } from "../types/staff.types";
import { STAFF_ROLE_LABELS } from "../constants/staff-role-labels";
import { useDeactivateStaff, useReactivateStaff } from "../hooks/use-staff";
import { ApiErrorResponse } from "@/types/api-response";

export function StaffCard({ staff }: { staff: StaffResponseData }) {
	const router = useRouter();
	const deactivateStaff = useDeactivateStaff();
	const reactivateStaff = useReactivateStaff();
	const initials = `${staff.firstName?.charAt(0) ?? ""}${staff.lastName?.charAt(0) ?? ""}`;

	async function handleToggle() {
		try {
			if (staff.isActive) {
				await deactivateStaff.mutateAsync(staff.id);
				toast.success("Staff member deactivated");
			} else {
				await reactivateStaff.mutateAsync(staff.id);
				toast.success("Staff member reactivated");
			}
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update status");
		}
	}

	return (
		<div className={`rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm ${!staff.isActive ? "opacity-60" : ""}`}>
			<div className="flex items-start gap-3">
				<div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
					{initials}
				</div>
				<div className="min-w-0 flex-1">
					<Link href={`/school-admin/staff/${staff.id}`} className="block truncate font-medium hover:underline">
						{staff.firstName} {staff.lastName}
					</Link>
					{staff.employeeId && <div className="text-xs text-muted-foreground">#{staff.employeeId}</div>}
				</div>
				<Badge variant="secondary" className="shrink-0">{STAFF_ROLE_LABELS[staff.role]}</Badge>

				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button variant="ghost" size="icon" className="-mr-2 size-8">
								<MoreHorizontal className="size-4" />
							</Button>
						}
					/>
					<DropdownMenuContent align="end" className="w-44">
						<DropdownMenuItem onClick={() => router.push(`/school-admin/staff/${staff.id}`)}>
							<Eye className="size-4" /> View profile
						</DropdownMenuItem>
						<DropdownMenuItem onClick={handleToggle}>
							{staff.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
							{staff.isActive ? "Deactivate" : "Reactivate"}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{staff.department && (
				<div className="mt-3 text-xs text-muted-foreground">Department: {staff.department}</div>
			)}

			<div className="mt-4 space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
				{staff.email && <div className="flex items-center gap-1.5"><Mail className="size-3" /> {staff.email}</div>}
				{staff.phone && <div className="flex items-center gap-1.5"><Phone className="size-3" /> {staff.phone}</div>}
			</div>
		</div>
	);
}