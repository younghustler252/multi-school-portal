export interface EnrichedAuditLog {
	id: string;
	actorId: string | null;
	actorName: string | null;
	actorType: string;
	schoolId: string | null;
	schoolName: string | null;
	action: string;
	entity: string;
	entityId: string | null;
	oldValue: unknown | null;
	newValue: unknown | null;
	// Human-readable line generated server-side, e.g. "Uploaded CAC Certificate",
	// "Published JSS3 mid-term results" — cheaper to compute once on write than
	// re-derive from action+entity+values on every render across every viewer.
	summary: string;
	createdAt: string;
}

export interface ListActivityParams {
	page?: number;
	limit?: number;
}