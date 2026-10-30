import { IFinanceSettingsRepository } from "../repositories/finance-settings.repository";
import { FinanceSettings, FinanceSettingsReader, resolveFinanceSettings } from "../domain/finance-settings";

/*
| FINANCE SETTINGS SERVICE: what the finance modules ask ("is approval needed above this amount?").
|
| It deliberately remembers NOTHING between calls. The container hands the same instance to every request, so a cached value
| would leak from one school into the next. One small indexed read per call is the price of that safety.
*/
export class FinanceSettingsService implements FinanceSettingsReader {
    constructor(private readonly d: { financeSettingsRepository: IFinanceSettingsRepository }) {}

    async get(): Promise<FinanceSettings> {
        return resolveFinanceSettings(await this.d.financeSettingsRepository.findOverrides());
    }
}
