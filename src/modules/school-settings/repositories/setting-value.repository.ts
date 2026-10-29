export interface ISchoolSettingValueRepository {
    /** The school's own values: { key: value }. A key with no row is not in the result. Finance keys (finance.*) are never returned. */
    findOverrides(keys?: readonly string[]): Promise<Record<string, unknown>>;
    set(key: string, value: boolean | number | string, userId: string | null): Promise<void>;
    /** Deleting the row restores the default. */
    remove(key: string): Promise<void>;
}
