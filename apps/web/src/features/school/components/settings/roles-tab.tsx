import { Check, Loader2, X } from "lucide-react";
import { SettingsSection } from "./settings-section";
import { useAccess } from "@/lib/use-access";
import { usePermissionCatalog, useRoles } from "@/features/school/hooks/use-roles";
import { accessDisplay, groupByModule, moduleAccess, moduleLabel, type ModuleAccess } from "@/features/school/lib/role-matrix";

function AccessCell({ access }: { access: ModuleAccess }) {
	const d = accessDisplay(access);
	if (d.kind === "none") return <X className="mx-auto size-4 text-muted-foreground/30" aria-label="No access" />;
	if (d.kind === "full") return <Check className="mx-auto size-4 text-primary" aria-label="Full access" />;
	return (
		<span className="text-xs whitespace-nowrap text-muted-foreground" title={`Widest scope · permissions held of ${access.total} in this area`}>
			{d.text}
		</span>
	);
}

export function RolesTab() {
	const me = useAccess();
	const allowed = me.can("roles.view");
	const roles = useRoles(allowed);
	const catalog = usePermissionCatalog(allowed);

	const description = "What each role can do across your school, read live from the system. Roles can't be edited here.";

	if (!allowed) {
		return (
			<SettingsSection title="Roles & permissions" description={description}>
				<p className="text-sm text-muted-foreground">You don&apos;t have permission to view roles.</p>
			</SettingsSection>
		);
	}
	if (roles.isLoading || catalog.isLoading) {
		return (
			<SettingsSection title="Roles & permissions" description={description}>
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</SettingsSection>
		);
	}
	if (!roles.data || !catalog.data) {
		return (
			<SettingsSection title="Roles & permissions" description={description}>
				<p className="text-sm text-destructive">Couldn&apos;t load roles. Please try again.</p>
			</SettingsSection>
		);
	}

	const modules = groupByModule(catalog.data);

	return (
		<SettingsSection title="Roles & permissions" description={description}>
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="sticky left-0 bg-muted/40 px-3 py-2 text-left">Area</th>
							{roles.data.map((role) => (
								<th key={role.id} className="px-3 py-2 text-center whitespace-nowrap" title={role.description ?? undefined}>
									{role.name}
									<div className="font-normal">{role.memberCount} {role.persona === "STAFF" ? "members" : "people"}</div>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{modules.map(({ module, keys }) => (
							<tr key={module} className="border-t border-border">
								<td className="sticky left-0 bg-card px-3 py-2.5 font-medium whitespace-nowrap">{moduleLabel(module)}</td>
								{roles.data.map((role) => {
									const a = moduleAccess(role, keys);
									return <td key={role.id} className="px-3 py-2.5 text-center"><AccessCell access={a} /></td>;
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</SettingsSection>
	);
}
