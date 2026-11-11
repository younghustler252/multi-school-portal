import type { Access } from "../../../foundation/access.service";
import { IStudentRepository } from "../../students/repositories/student.repository";
import { IGuardianRepository } from "../../guardians/repositories/guardian.repository";
import { IStaffRepository } from "../../staff/repositories/staff.repository";
import { both, guardianAudienceWhere, staffAudienceWhere, studentAudienceWhere } from "../../notifications/domain/audience";
import type { CalendarEventEntity } from "../domain/event.entity";
import { wantsOf } from "../domain/event.notice";
import { seesEveryEvent } from "../domain/event.scope";

interface Deps {
    studentRepository:  Pick<IStudentRepository, "findMany">;
    guardianRepository: Pick<IGuardianRepository, "findMany">;
    staffRepository:    Pick<IStaffRepository, "findMany">;
}

/*
| WHO SEES WHICH EVENT. The same audience rules that decide who is NOTIFIED decide who SEES the event (domain/audience.ts fragments),
| so the two can never disagree:
|   managers (events.manage / events.publish)  every event, drafts included
|   everyone else                               published and cancelled events whose audience includes them
| A student is matched by their branch and current class, a parent by their children, a staff member by branch and teaching category.
| A person whose record cannot be found sees only events for the whole school. Never throws for "not in the audience": the event is just not listed.
*/
export class EventViewerService {
    constructor(private readonly d: Deps) {}

    /** Returns a predicate for ONE viewer; repeated audiences are looked up once. */
    forViewer(access: Access | undefined): (e: CalendarEventEntity) => Promise<boolean> {
        if (seesEveryEvent(access)) return async () => true;
        const cache = new Map<string, boolean>();
        return async (e) => {
            if (e.status === "DRAFT") return false;
            const w = wantsOf(e.audienceKinds);
            const persona = access?.persona ?? null;
            const wanted = persona === "STUDENT" ? w.students : persona === "GUARDIAN" ? w.guardians : persona === "STAFF" ? w.staff : false;
            if (!wanted || !access?.personaEntityId) return false;
            const filter = { branchIds: e.branchIds, classIds: e.classIds, staffCategories: persona === "STAFF" ? w.staffCategories : undefined };
            const unnarrowed = e.branchIds.length === 0 && e.classIds.length === 0 && !filter.staffCategories;
            if (unnarrowed) return true;
            const key = `${persona}|${e.branchIds.join(",")}|${e.classIds.join(",")}|${(filter.staffCategories ?? []).join(",")}`;
            if (cache.has(key)) return cache.get(key)!;
            const id = access.personaEntityId;
            const found = persona === "STUDENT" ? await this.d.studentRepository.findMany(both({ id }, studentAudienceWhere(filter)))
                : persona === "GUARDIAN" ? await this.d.guardianRepository.findMany(both({ id }, guardianAudienceWhere(filter)))
                : await this.d.staffRepository.findMany(both({ id }, staffAudienceWhere(filter)));
            const ok = found.length > 0;
            cache.set(key, ok);
            return ok;
        };
    }
}
