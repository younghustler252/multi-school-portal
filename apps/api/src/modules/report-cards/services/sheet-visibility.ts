import { isVisibleToFamilies } from "../../grades/domain/sheet.policy";
/** A mark sheet counts for a report card only when it is published or locked (never a draft, submitted or approved sheet). */
export const isVisibleSheet = (status: string): boolean => isVisibleToFamilies(status as Parameters<typeof isVisibleToFamilies>[0]);
