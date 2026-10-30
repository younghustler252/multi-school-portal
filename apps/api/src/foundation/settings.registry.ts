import { NOTIFICATION_SETTING_DEFS } from "../modules/notifications/notifications.settings";
import { AUTOMATION_SETTING_DEFS } from "../modules/automation/automation.settings";
import { SettingDef, SettingValue, resolveValues, validateDefinitions } from "./settings.engine";

/*
|--------------------------------------------------------------------------
| SETTINGS REGISTRY (code)
| Every school preference the platform knows, gathered from the modules that own them (module.settings.ts).
| Each module adds its own list below. A key is never reused for something else.
| Finance settings (finance.*) live in the finance-settings module and are not part of this list.
|--------------------------------------------------------------------------
*/
export const SETTING_DEFS: readonly SettingDef[] = [
    ...NOTIFICATION_SETTING_DEFS,
    ...AUTOMATION_SETTING_DEFS,
];

export const SETTING_BY_KEY: ReadonlyMap<string, SettingDef> = new Map(SETTING_DEFS.map(d => [d.key, d]));

/** Empty means the registry is valid. */
export const validateSettingsRegistry = (): string[] => validateDefinitions(SETTING_DEFS);

/*
| What the other modules depend on. The reader is OPTIONAL in their dependencies: when it is absent (unit tests
| that build a use case by hand) the defaults apply, which are the values the behaviour had before the setting existed.
*/
export interface PreferencesReader { all(): Promise<Record<string, SettingValue>> }

export const defaultPreferences = (): Record<string, SettingValue> => resolveValues(SETTING_DEFS, {});

export async function preferencesOf(d: { schoolPreferencesService?: PreferencesReader }): Promise<Record<string, SettingValue>> {
    return d.schoolPreferencesService ? d.schoolPreferencesService.all() : defaultPreferences();
}
