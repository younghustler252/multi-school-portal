/* A school's event type: either one of the 11 system types (isSystem, never renamed or removed) or a custom type the School Admin made. */
export interface EventTypeEntity {
    id:          string;
    key:         string;           // stable identifier; set at creation and never changes
    name:        string;           // display label
    nameKey:     string;           // lower-cased, space-collapsed name: what "the same name" means
    color:       string | null;    // #RRGGBB
    icon:        string | null;    // icon id from the frontend's set, lowercase letters, digits, hyphens
    isSystem:    boolean;
    isActive:    boolean;
    createdById: string | null;
    createdAt:   Date;
    updatedAt:   Date;
}

/** The compact form events carry in their responses. */
export interface EventTypeRef { id: string; key: string; name: string; color: string | null; icon: string | null; isSystem: boolean; isActive: boolean }
