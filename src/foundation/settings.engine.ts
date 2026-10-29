/*
|--------------------------------------------------------------------------
| SETTINGS ENGINE (pure: no database, no clock)
|
| One small engine behind every per-school preference. A module describes its settings as a list of definitions
| (key, type, default, limits). The engine checks a value somebody is saving, reads a stored value forgivingly,
| and describes the settings for a screen.
|
| A school's own value is a row in the tenant table SchoolSettingValue (one row per key). Deleting the row
| restores the default, so a school that never touched a setting behaves exactly as the code says.
|
| Writing is strict (the right type, inside the allowed range). Reading is forgiving: a stored value that is
| not valid any more (an old shape, a range that changed) falls back to the default instead of breaking a job.
|
| Finance keeps its own copy of these rules (finance-settings module) and is untouched; new modules use this one.
|--------------------------------------------------------------------------
*/

export type SettingKind = "boolean" | "integer" | "enum" | "string" | "time";
export type SettingValue = boolean | number | string;

export interface SettingDef {
    /** "module.name", lowercase words joined by dots or underscores. The module part is the owner. */
    key:         string;
    kind:        SettingKind;
    group:       string;
    label:       string;
    description: string;
    default:     SettingValue;
    min?:        number;            // integer
    max?:        number;            // integer
    options?:    readonly string[]; // enum
    maxLength?:  number;            // string (default 200)
}

export type Checked = { ok: true; value: SettingValue } | { ok: false; message: string };

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const KEY_PATTERN  = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

const inRange = (def: SettingDef, n: number): string | null => {
    if (def.min !== undefined && n < def.min) return `${def.label}: must be at least ${def.min}`;
    if (def.max !== undefined && n > def.max) return `${def.label}: must be at most ${def.max}`;
    return null;
};

/** Strict check for a value somebody is saving. */
export function validateSettingValue(def: SettingDef, raw: unknown): Checked {
    switch (def.kind) {
        case "boolean":
            return typeof raw === "boolean" ? { ok: true, value: raw } : { ok: false, message: `${def.label}: must be true or false` };
        case "integer": {
            if (typeof raw !== "number" || !Number.isInteger(raw)) return { ok: false, message: `${def.label}: must be a whole number` };
            const problem = inRange(def, raw);
            return problem ? { ok: false, message: problem } : { ok: true, value: raw };
        }
        case "enum":
            return typeof raw === "string" && (def.options ?? []).includes(raw)
                ? { ok: true, value: raw }
                : { ok: false, message: `${def.label}: must be one of ${(def.options ?? []).join(", ")}` };
        case "string": {
            if (typeof raw !== "string") return { ok: false, message: `${def.label}: must be text` };
            const text = raw.trim();
            const max = def.maxLength ?? 200;
            return text.length > max ? { ok: false, message: `${def.label}: must be at most ${max} characters` } : { ok: true, value: text };
        }
        case "time":
            return typeof raw === "string" && TIME_PATTERN.test(raw)
                ? { ok: true, value: raw }
                : { ok: false, message: `${def.label}: must be a time like 08:00 (24 hour clock)` };
    }
}

/** Forgiving read of a stored value: accepts "true" and "3" written as text, then applies the same rules. */
export function coerceStored(def: SettingDef, raw: unknown): Checked {
    if (def.kind === "boolean" && (raw === "true" || raw === "false")) raw = raw === "true";
    if (def.kind === "integer" && typeof raw === "string" && /^-?\d+$/.test(raw.trim())) raw = Number(raw.trim());
    return validateSettingValue(def, raw);
}

const has = (overrides: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(overrides, key);

/** The school's effective value for every definition: its own valid override, else the default. */
export function resolveValues(defs: readonly SettingDef[], overrides: Record<string, unknown>): Record<string, SettingValue> {
    const out: Record<string, SettingValue> = {};
    for (const def of defs) {
        const stored = has(overrides, def.key) ? coerceStored(def, overrides[def.key]) : null;
        out[def.key] = stored && stored.ok ? stored.value : def.default;
    }
    return out;
}

export interface DescribedSetting {
    key: string; group: string; label: string; description: string; kind: SettingKind;
    value: SettingValue; default: SettingValue; isOverridden: boolean;
    min?: number; max?: number; options?: readonly string[]; maxLength?: number;
}

/** One row per setting for a settings screen: what it is, what applies now, and whether the school changed it. */
export function describeSettings(defs: readonly SettingDef[], overrides: Record<string, unknown>): DescribedSetting[] {
    return defs.map(def => {
        const stored = has(overrides, def.key) ? coerceStored(def, overrides[def.key]) : null;
        const overridden = !!stored && stored.ok;
        return {
            key: def.key, group: def.group, label: def.label, description: def.description, kind: def.kind,
            value: overridden ? (stored as { value: SettingValue }).value : def.default,
            default: def.default, isOverridden: overridden,
            ...(def.min !== undefined && { min: def.min }), ...(def.max !== undefined && { max: def.max }),
            ...(def.options && { options: def.options }), ...(def.maxLength !== undefined && { maxLength: def.maxLength }),
        };
    });
}

/** Problems with a list of definitions (empty means valid): bad keys, duplicates, defaults that fail their own rules. */
export function validateDefinitions(defs: readonly SettingDef[]): string[] {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const def of defs) {
        if (!KEY_PATTERN.test(def.key)) problems.push(`${def.key}: key must be lowercase dotted words`);
        if (seen.has(def.key)) problems.push(`${def.key}: defined more than once`);
        seen.add(def.key);
        if (def.key.startsWith("finance.")) problems.push(`${def.key}: finance.* belongs to the finance settings module`);
        const checked = validateSettingValue(def, def.default);
        if (!checked.ok) problems.push(`${def.key}: its default is not allowed (${checked.message})`);
        if (def.kind === "enum" && (!def.options || def.options.length === 0)) problems.push(`${def.key}: an enum needs options`);
    }
    return problems;
}
