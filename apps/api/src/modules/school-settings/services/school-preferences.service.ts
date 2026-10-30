import { ISchoolSettingValueRepository } from "../repositories/setting-value.repository";
import { SETTING_DEFS } from "../../../foundation/settings.registry";
import { PreferencesReader } from "../../../foundation/settings.registry";
import { SettingValue, resolveValues } from "../../../foundation/settings.engine";

/*
| SCHOOL PREFERENCES SERVICE: what the other modules ask ("may this school send SMS?", "is automation on?").
|
| It deliberately remembers NOTHING between calls. The container hands the same instance to every request and job,
| so a cached value would leak from one school into the next. One small indexed read per call is the price of that safety.
*/
export class SchoolPreferencesService implements PreferencesReader {
    constructor(private readonly d: { schoolSettingValueRepository: ISchoolSettingValueRepository }) {}

    async all(): Promise<Record<string, SettingValue>> {
        return resolveValues(SETTING_DEFS, await this.d.schoolSettingValueRepository.findOverrides(SETTING_DEFS.map(def => def.key)));
    }
}
