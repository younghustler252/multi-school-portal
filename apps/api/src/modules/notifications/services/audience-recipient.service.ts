import type { IStudentRepository }  from "../../students/repositories/student.repository";
import type { IGuardianRepository } from "../../guardians/repositories/guardian.repository";
import type { IStaffRepository }    from "../../staff/repositories/staff.repository";
import type { IUserRepository }     from "../../auth/repositories/user.repository";
import { ACTIVE_STUDENT_WHERE, guardianAnnouncementWhere } from "../../students/domain/student-eligibility";
import { AudienceFilter, both, guardianAudienceWhere, staffAudienceWhere, studentAudienceWhere } from "../domain/audience";
import { notificationErrors } from "../domain/notification.errors";
import type { RecipientKind } from "../domain/notification.entity";

/*
|--------------------------------------------------------------------------
| AUDIENCE RECIPIENT SERVICE: turns "who should hear this" into real people with their contact details.
| This is the lookup that used to live inside the announcement use case; it moved here unchanged so that announcements,
| and anything else that messages a group (school events), resolve people ONE way. The rules it applies:
|   - students: on the books and not graduated (unless graduates are asked for); contact comes from their user account
|   - guardians: the announcement rule (left out only when ALL their children graduated); their own email and phone
|   - staff: active staff; contact comes from their user account
|   - an audience filter (branch / class / staff category) narrows each group
|   - people named by id replace the group rule; for a LIMITED sender (branch scope) any id that did not come back is refused
| It only READS. Who may send, and to which branches, is decided before (domain/audience.ts resolveAudience).
|--------------------------------------------------------------------------
*/
export interface ResolvedRecipient { type: RecipientKind; id: string; userId: string | null; email: string | null; phone: string | null }

export interface RecipientQuery {
    wantsStudents?:  boolean;
    wantsGuardians?: boolean;
    wantsStaff?:     boolean;
    studentIds?:     string[];
    guardianIds?:    string[];
    staffIds?:       string[];
    includeGraduates?: boolean;
    filter:          AudienceFilter;
    /** The sender is branch-limited: named people outside the audience are refused instead of silently dropped. */
    limited?:        boolean;
}

interface Dependencies {
    studentRepository:  Pick<IStudentRepository, "findMany">;
    guardianRepository: Pick<IGuardianRepository, "findMany">;
    staffRepository:    Pick<IStaffRepository, "findMany">;
    userRepository:     Pick<IUserRepository, "findByIds">;
}

const has = (a?: string[]) => !!a && a.length > 0;

export class AudienceRecipientService {
    constructor(private readonly d: Dependencies) {}

    /** Students first, then guardians, then staff. */
    async resolve(q: RecipientQuery): Promise<ResolvedRecipient[]> {
        const out: ResolvedRecipient[] = [];
        const { filter, limited } = q;

        if (q.wantsStudents) {
            const base = has(q.studentIds) ? { id: { in: q.studentIds } } : q.includeGraduates ? { isActive: true } : { ...ACTIVE_STUDENT_WHERE };
            const students = await this.d.studentRepository.findMany(both(base, studentAudienceWhere(filter)));
            if (limited && has(q.studentIds) && students.length < new Set(q.studentIds).size) throw notificationErrors.audienceOutOfScope();
            const userIds = students.map(s => s.userId).filter(Boolean) as string[];
            const users = userIds.length ? await this.d.userRepository.findByIds(userIds) : [];
            const byId = new Map(users.map(u => [u.id, u]));
            for (const s of students) {
                const u = s.userId ? byId.get(s.userId) : null;
                out.push({ type: "STUDENT", id: s.id, userId: s.userId ?? null, email: u?.email ?? null, phone: u?.phone ?? null });
            }
        }
        if (q.wantsGuardians) {
            const base = has(q.guardianIds) ? { id: { in: q.guardianIds } } : guardianAnnouncementWhere(!!q.includeGraduates);
            const guardians = await this.d.guardianRepository.findMany(both(base, guardianAudienceWhere(filter)));
            if (limited && has(q.guardianIds) && guardians.length < new Set(q.guardianIds).size) throw notificationErrors.audienceOutOfScope();
            for (const g of guardians) out.push({ type: "GUARDIAN", id: g.id, userId: (g as any).userId ?? null, email: g.email ?? null, phone: g.phone ?? null });
        }
        if (q.wantsStaff) {
            const base = has(q.staffIds) ? { id: { in: q.staffIds } } : { isActive: true };
            const staff = await this.d.staffRepository.findMany(both(base, staffAudienceWhere(filter)));
            if (limited && has(q.staffIds) && staff.length < new Set(q.staffIds).size) throw notificationErrors.audienceOutOfScope();
            const userIds = staff.map(s => s.userId).filter(Boolean) as string[];
            const users = userIds.length ? await this.d.userRepository.findByIds(userIds) : [];
            const byId = new Map(users.map(u => [u.id, u]));
            for (const s of staff) {
                const u = s.userId ? byId.get(s.userId) : null;
                out.push({ type: "STAFF", id: s.id, userId: s.userId ?? null, email: u?.email ?? null, phone: u?.phone ?? null });
            }
        }
        return out;
    }
}
