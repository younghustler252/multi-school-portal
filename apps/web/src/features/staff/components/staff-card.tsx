"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Phone, MoreHorizontal, Eye, UserX, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAccess } from "@/lib/use-access";
import { ROUTES } from "@/lib/routes";
import type { StaffResponseData } from "../types/staff.types";
import { PORTAL_STATUS_LABELS, STAFF_CATEGORY_LABELS } from "../constants/staff-labels";
import { StaffStatusDialog } from "./staff-status-dialog";

/** Role names come from the server (the person's assigned portal roles); there is no role field on a staff record itself. */
export function portalSummary(staff: StaffResponseData): string {
	const names = staff.portal.roles.map((r) => r.name);
	return names.length > 0 ? names.join(", ") : PORTAL_STATUS_LABELS[staff.portal.status];
}

export function StaffCard({ staff }: { staff: StaffResponseData }) {
	const router = useRouter();
	const me = useAccess();
	const canManage = me.can("staff.manage");
	const [statusOpen, setStatusOpen] = useState(false);
	const initials = `${staff.firstName.charAt(0)}${staff.lastName.charAt(0)}`;

	return (
		<div className={`rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm ${!staff.isActive ? "opacity-60" : ""}`}>
			<div className="flex items-start gap-3">
				<div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials}</div>
				<div className="min-w-0 flex-1">
					<Link href={ROUTES.school.staff.detail(staff.id)} className="block truncate font-medium hover:underline">{staff.fullName}</Link>
					{staff.employeeId && <div className="text-xs text-muted-foreground">#{staff.employeeId}</div>}
				</div>
				<Badge variant="secondary" className="max-w-32 shrink-0 truncate" title={portalSummary(staff)}>{portalSummary(staff)}</Badge>

				<DropdownMenu>
					<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="-mr-2 size-8"><MoreHorizontal className="size-4" /></Button>} />
					<DropdownMenuContent align="end" className="w-44">
						<DropdownMenuItem onClick={() => router.push(ROUTES.school.staff.detail(staff.id))}>
							<Eye className="size-4" /> View profile
						</DropdownMenuItem>
						{canManage && (
							<DropdownMenuItem onClick={() => setStatusOpen(true)}>
								{staff.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
								{staff.isActive ? "Deactivate" : "Reactivate"}
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="mt-3 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
				<Badge variant="outline" className="font-normal">{STAFF_CATEGORY_LABELS[staff.category]}</Badge>
				{staff.department && <Badge variant="outline" className="font-normal">{staff.department}</Badge>}
				{!staff.isActive && <Badge variant="outline" className="font-normal">Inactive</Badge>}
			</div>

			<div className="mt-4 space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
				{staff.email && <div className="flex items-center gap-1.5"><Mail className="size-3" /> {staff.email}</div>}
				{staff.phone && <div className="flex items-center gap-1.5"><Phone className="size-3" /> {staff.phone}</div>}
			</div>

			{canManage && <StaffStatusDialog staff={staff} open={statusOpen} onOpenChange={setStatusOpen} />}
		</div>
	);
}
