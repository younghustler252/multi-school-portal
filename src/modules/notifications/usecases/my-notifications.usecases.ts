import { INotificationRepository, RecipientOwner } from "../repositories/notification.repository";
import { PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { notificationErrors } from "../domain/notification.errors";
import type { Persona } from "../../../foundation/access.service";

/* The signed-in person's own inbox. WHO they are comes from the session (persona and the id of their own record),
   never from a role name or from anything the request says. */
export interface Inbox { persona: Persona | null; personaEntityId: string | null }

const ownerOf = (who: Inbox): RecipientOwner => {
    if (!who.persona || !who.personaEntityId) throw notificationErrors.noInbox();
    return { recipientType: who.persona, recipientEntityId: who.personaEntityId };
};

interface Dependencies { notificationRepository: INotificationRepository }

export class GetMyNotificationsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(who: Inbox, params: { page?: number; limit?: number }): Promise<PaginatedResult<any>> {
        return this.d.notificationRepository.findMySchoolNotifications(ownerOf(who), params);
    }
}

export class MarkNotificationReadUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(who: Inbox, recipientId: string): Promise<void> {
        const ok = await this.d.notificationRepository.markSchoolRecipientRead(recipientId, ownerOf(who));
        if (!ok) throw notificationErrors.notYours();     // not theirs and not there look the same
    }
}

export class MarkAllNotificationsReadUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(who: Inbox): Promise<{ marked: number }> {
        return { marked: await this.d.notificationRepository.markAllSchoolRecipientsRead(ownerOf(who)) };
    }
}

/* The platform's messages to this school (billing notices, announcements). The route needs notifications.platform.view. */
export class GetPlatformInboxUseCase {
    constructor(private readonly d: Dependencies) {}
    execute(schoolId: string, params: { page?: number; limit?: number }): Promise<PaginatedResult<any>> {
        return this.d.notificationRepository.findMyPlatformNotifications(schoolId, params);
    }
}

export class MarkPlatformMessageReadUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(schoolId: string, recipientId: string): Promise<void> {
        if (!(await this.d.notificationRepository.markPlatformRecipientRead(recipientId, schoolId))) throw notificationErrors.notYours();
    }
}
