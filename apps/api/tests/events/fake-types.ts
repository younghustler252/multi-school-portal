import { SYSTEM_EVENT_TYPES, HOLIDAY_TYPE_ID } from "../../src/modules/events/domain/event-type.catalog";

/* Shared by the in-memory event repositories: the type table (11 system types + one custom active + one custom inactive) and a stand-in for
   the database trigger that keeps eventTypeId, the enum mirror `type` and isHoliday in step. */
const row = (o: any) => ({ color: null, icon: null, isSystem: false, isActive: true, createdById: null, createdAt: new Date(0), updatedAt: new Date(0), ...o, nameKey: o.name.toLowerCase() });
export const QUIZ_ID = "c0000000-0000-4000-8000-000000000001", OLD_ID = "c0000000-0000-4000-8000-000000000002";
export const typeTable = () => [
    ...SYSTEM_EVENT_TYPES.map(t => row({ ...t, isSystem: true })),
    row({ id: QUIZ_ID, key: "quiz", name: "Quiz", color: "#123456", icon: "star" }),
    row({ id: OLD_ID, key: "old-type", name: "Old type", isActive: false }),
];
export const typeRepository = (table = typeTable()): any => ({
    findById: async (id: string) => table.find(t => t.id === id) ?? null,
    findByKey: async (key: string) => table.find(t => t.key === key) ?? null,
});
export function applyType(r: any, table = typeTable()): any {
    const byId = r.eventTypeId ? table.find(t => t.id === r.eventTypeId) : table.find(t => t.isSystem && t.key === (r.type ?? "event"));
    if (!byId) return r;
    return { ...r, eventTypeId: byId.id, eventType: { id: byId.id, key: byId.key, name: byId.name, color: byId.color, icon: byId.icon, isSystem: byId.isSystem, isActive: byId.isActive }, type: byId.isSystem ? byId.key : "other", isHoliday: byId.id === HOLIDAY_TYPE_ID };
}
