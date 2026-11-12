import { eventTypeErrors } from "./event-type.errors";
import type { EventTypeEntity } from "./event-type.entity";

/* EVENT TYPE RULES. The database enforces the same shapes with CHECK constraints and triggers; these give clear errors first. */
export const MAX_CUSTOM_EVENT_TYPES = 50;     // inactive types count: deactivating does not free a slot, deleting does
export const NAME_MIN = 2;
export const NAME_MAX = 40;
export const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
export const ICON_PATTERN = /^[a-z0-9-]{1,40}$/;
export const NAME_FORBIDDEN = /[<>\u0000-\u001f\u007f]/;

/** The name as stored: trimmed, inner whitespace collapsed to single spaces. */
export const cleanName = (name: string): string => name.replace(/\s+/g, " ").trim();
/** What "the same name" means: case and spacing never make two names different. Matches the SQL CHECK on nameKey. */
export const nameKeyOf = (name: string): string => cleanName(name).toLowerCase();

/** Slug from a name: lowercase letters and digits separated by single hyphens, 2-40 characters. "Inter-house Quiz!" -> "inter-house-quiz". */
export function slugOf(name: string): string {
    const base = cleanName(name).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36).replace(/-+$/g, "");
    return base.length >= 2 ? base : `type-${base || "x"}`.slice(0, 36);
}
/** key, key-2, key-3 ... : tried in order until one is free. The bare slug is never reused after a clash with a system key. */
export const keyCandidate = (base: string, attempt: number): string => (attempt === 0 ? base : `${base}-${attempt + 1}`);

export function assertCanCreateCustom(customCount: number): void {
    if (customCount >= MAX_CUSTOM_EVENT_TYPES) throw eventTypeErrors.limit(MAX_CUSTOM_EVENT_TYPES);
}

export interface TypeChanges { name?: string; color?: string | null; icon?: string | null; isActive?: boolean }

/** System types keep their name, key and state; only colour and icon are the school's to change. */
export function assertChangeAllowed(type: Pick<EventTypeEntity, "isSystem" | "name" | "isActive">, changes: TypeChanges): void {
    if (!type.isSystem) return;
    const renames = changes.name !== undefined && cleanName(changes.name) !== type.name;
    const toggles = changes.isActive !== undefined && changes.isActive !== type.isActive;
    if (renames || toggles) throw eventTypeErrors.protected();
}
export function assertCanDelete(type: Pick<EventTypeEntity, "isSystem">, eventsUsing: number): void {
    if (type.isSystem) throw eventTypeErrors.protected();
    if (eventsUsing > 0) throw eventTypeErrors.inUse(eventsUsing);
}
