import { PrismaClient } from "../../../generated/public";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { ISchoolRepository } from "../repositories/school.repository";
import { schoolErrors } from "../domain/school.errors";
import { requiredDocsFor } from "../domain/school.policy";

interface Dependencies { prismaClient: PrismaClient; schoolRepository: ISchoolRepository }

export interface ChecklistItem {
    key:      string;
    group:    "school" | "verification" | "academics" | "people";
    label:    string;
    done:     boolean;
    locked:   boolean;        // true when it cannot be done yet (for example payments before verification)
    required: boolean;
}

export interface SetupChecklist {
    items:             ChecklistItem[];
    completionPercent: number;
    verification: {
        status:    string;
        note:      string | null;
        documents: { type: string; status: "missing" | "pending" | "under_review" | "approved" | "rejected" }[];
    };
}

/*
| SETUP CHECKLIST: guides a new school from "just registered" to "ready to use".
| Returned as a list (the old fixed-key object could not grow); keys are stable, labels are
| English defaults the frontend may translate. Modules add items here as they are built.
*/
export class GetSetupChecklistUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(schoolId: string): Promise<SetupChecklist> {
        const d = this.d;
        const school = await d.schoolRepository.findById(schoolId);
        if (!school) throw schoolErrors.notFound();
        const db = getTenantClient();

        const [docs, staff, students, classes, subjects, sessions, currentTerm, enrolments, pendingInvites] = await Promise.all([
            d.schoolRepository.findDocumentsBySchoolId(schoolId),
            db.staff.count(), db.student.count(), db.class.count(), db.subject.count(),
            db.session.count(), db.term.count({ where: { isCurrent: true } }), db.enrolment.count(),
            d.prismaClient.invite.count({ where: { schoolId, accepted: false, revokedAt: null, expiresAt: { gt: new Date() } } }),
        ]);

        const verified = school.verificationStatus === "verified";
        const documents = requiredDocsFor(school.schoolOwnership).map(type => {
            const ofType = docs.filter(x => x.type === type);
            const status = ofType.some(x => x.status === "approved") ? "approved"
                         : ofType.some(x => x.status === "under_review") ? "under_review"
                         : ofType.some(x => x.status === "pending") ? "pending"
                         : ofType.some(x => x.status === "rejected") ? "rejected" : "missing";
            return { type, status } as SetupChecklist["verification"]["documents"][number];
        });

        const items: ChecklistItem[] = [
            { key: "school_profile",  group: "school",       label: "Complete the school profile", required: true,  locked: false,
              done: !!(school.phone && school.address && school.city && school.state) },
            { key: "school_logo",     group: "school",       label: "Upload the school logo", required: false, locked: false, done: !!school.logoUrl },
            { key: "documents",       group: "verification", label: "Upload verification documents", required: true, locked: false,
              done: documents.every(x => x.status !== "missing") },
            { key: "verified",        group: "verification", label: "Get the school verified", required: true, locked: false, done: verified },
            { key: "payment_account", group: "verification", label: "Set up the payment account", required: false, locked: !verified, done: !!school.paystackSubaccountCode },
            { key: "academic_session", group: "academics",   label: "Create the academic session", required: true, locked: false, done: sessions > 0 },
            { key: "current_term",    group: "academics",    label: "Set the current term", required: true, locked: false, done: currentTerm > 0 },
            { key: "classes",         group: "academics",    label: "Create classes", required: true, locked: false, done: classes > 0 },
            { key: "subjects",        group: "academics",    label: "Add subjects", required: true, locked: false, done: subjects > 0 },
            { key: "staff",           group: "people",       label: "Invite your staff", required: false, locked: false, done: staff > 1 || pendingInvites > 0 },
            { key: "students",        group: "people",       label: "Add students", required: true, locked: false, done: students > 0 },
            { key: "enrolment",       group: "people",       label: "Enrol students into classes", required: true, locked: false, done: enrolments > 0 },
        ];

        const required = items.filter(i => i.required);
        const completionPercent = Math.round((required.filter(i => i.done).length / required.length) * 100);
        return { items, completionPercent, verification: { status: school.verificationStatus, note: school.verificationNote, documents } };
    }
}
