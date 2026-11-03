import type { Access } from "../../../foundation/access.service";

// Who is doing the action. Comes ONLY from the verified session, never from the request body.
// `access` says which branches the person may act on (classes.view / classes.manage at ALL or BRANCH scope).
export interface ClassActor { userId: string; access: Access }
