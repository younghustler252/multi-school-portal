/*
| THE SYSTEM EVENT TYPES, as the application knows them. The database holds the same list once, in the SQL function
| event_type_system_catalog() (migration 20261110090000_event_types_catalog), which both seeds the table and guards it with a trigger;
| a test fails if the two ever differ. `key` is the stable identifier clients and code use; the display name is only a label.
*/
export interface SystemEventType { readonly id: string; readonly key: string; readonly name: string; readonly nameKey: string }

export const SYSTEM_EVENT_TYPES: readonly SystemEventType[] = [
    { id: "00000000-0000-4000-8000-000000000001", key: "holiday",    name: "Holiday",    nameKey: "holiday" },
    { id: "00000000-0000-4000-8000-000000000002", key: "event",      name: "Event",      nameKey: "event" },
    { id: "00000000-0000-4000-8000-000000000003", key: "exam",       name: "Exam",       nameKey: "exam" },
    { id: "00000000-0000-4000-8000-000000000004", key: "break",      name: "Break",      nameKey: "break" },
    { id: "00000000-0000-4000-8000-000000000005", key: "other",      name: "Other",      nameKey: "other" },
    { id: "00000000-0000-4000-8000-000000000006", key: "meeting",    name: "Meeting",    nameKey: "meeting" },
    { id: "00000000-0000-4000-8000-000000000007", key: "sports",     name: "Sports",     nameKey: "sports" },
    { id: "00000000-0000-4000-8000-000000000008", key: "ceremony",   name: "Ceremony",   nameKey: "ceremony" },
    { id: "00000000-0000-4000-8000-000000000009", key: "graduation", name: "Graduation", nameKey: "graduation" },
    { id: "00000000-0000-4000-8000-000000000010", key: "resumption", name: "Resumption", nameKey: "resumption" },
    { id: "00000000-0000-4000-8000-000000000011", key: "pta",        name: "PTA",        nameKey: "pta" },
];

/** The only type that makes an event a holiday for attendance. Never matched by display name. */
export const HOLIDAY_TYPE_KEY = "holiday";
export const HOLIDAY_TYPE_ID = SYSTEM_EVENT_TYPES.find(t => t.key === HOLIDAY_TYPE_KEY)!.id;
