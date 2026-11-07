"use client";

import { Button } from "@/components/ui/button";
import type { Persona, Selection } from "@/lib/auth/session-types";

const PERSONA_LABEL: Record<Persona, { title: string; hint: string }> = {
	STAFF: { title: "Staff", hint: "Work in the school" },
	STUDENT: { title: "Student", hint: "Your own records" },
	GUARDIAN: { title: "Parent / Guardian", hint: "Your children's records" },
};

// Only follow http(s) links the API sent us.
function isSafeUrl(url: string): boolean {
	try {
		const u = new URL(url);
		return u.protocol === "https:" || u.protocol === "http:";
	} catch {
		return false;
	}
}

interface Props {
	selection: Selection;
	pending: boolean;
	error?: string | null;
	onPersona: (persona: Persona) => void;
	onCancel: () => void;
}

/** The second step of login: which persona to sign in as, or which school to open. */
export function LoginSelection({ selection, pending, error, onPersona, onCancel }: Props) {
	return (
		<div className="space-y-4 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm">
			<div>
				<h2 className="text-base font-semibold">{selection.kind === "persona" ? "How do you want to continue?" : "Choose your school"}</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					{selection.kind === "persona" ? "Your account has more than one role here." : "Your account belongs to more than one school."}
				</p>
			</div>

			{error && (
				<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			)}

			<ul className="space-y-2">
				{selection.kind === "persona"
					? selection.personas.map((p) => (
							<li key={p}>
								<Button type="button" variant="outline" className="h-auto min-h-12 w-full justify-start py-2.5 text-left" disabled={pending} onClick={() => onPersona(p)}>
									<span className="flex flex-col">
										<span className="font-medium">{PERSONA_LABEL[p].title}</span>
										<span className="text-xs font-normal text-muted-foreground">{PERSONA_LABEL[p].hint}</span>
									</span>
								</Button>
							</li>
						))
					: selection.schools.map((s) => (
							<li key={s.id}>
								<Button
									type="button"
									variant="outline"
									className="h-auto min-h-12 w-full justify-start py-2.5 text-left"
									disabled={!isSafeUrl(s.url)}
									onClick={() => window.location.assign(s.url)}
								>
									<span className="font-medium">{s.name}</span>
								</Button>
							</li>
						))}
			</ul>

			<Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
				Back
			</Button>
		</div>
	);
}
