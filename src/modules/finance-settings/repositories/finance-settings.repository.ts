export interface IFinanceSettingsRepository {
    /** The school's own values for the finance.* keys: { key: value }. A key with no row is not in the result. */
    findOverrides(): Promise<Record<string, unknown>>;
    set(key: string, value: boolean | number | string, userId: string): Promise<void>;
    /** Deleting the row restores the default. */
    remove(key: string): Promise<void>;
}
