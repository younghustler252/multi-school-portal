import type { Access } from "../../../foundation/access.service";

/** Who is acting (always from the verified session, never from the request body). */
export interface RolesActor {
    userId:       string;
    access:       Access;
}
