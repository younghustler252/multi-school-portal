import { createContainer, InjectionMode } from "awilix";
import type { AwilixContainer }           from "awilix";
import { registerShared }                 from "./shared.container";
import { prisma, disconnectPrisma }       from "../infrastructure/database/prisma/prisma.client";

/*
|--------------------------------------------------------------------------
| CONTAINER
|--------------------------------------------------------------------------
*/
export const container: AwilixContainer = createContainer({
    injectionMode: InjectionMode.PROXY,
    strict:        false,
});

/*
|--------------------------------------------------------------------------
| MODULE REGISTRATIONS
| Uncomment each module as you build it
|--------------------------------------------------------------------------

*/
import { registerAudit } from "../modules/audit/audit.container";
import { registerFoundation } from "../foundation/foundation.container";
import { registerAuth }          from "../modules/auth/auth.container";
import { registerSchool }        from "../modules/school/school.container";
import { registerUser }          from "../modules/user/user.container";
import { registerPlans }         from "../modules/plans/plans.container";
import { registerSubscriptions } from "../modules/subscriptions/subscription.container";
import { registerBranches } from "../modules/branches/branches.container";
import { registerStaff }         from "../modules/staff/staff.container";
import { registerLedger } from "../modules/ledger/ledger.container";
import { registerStudents }      from "../modules/students/students.container";
import { registerGuardians }     from "../modules/guardians/guardians.container";
// import { registerClasses }       from "../modules/classes/classes.container";
// import { registerSessions } from "../modules/sessions/sessions.container";
// import { registerEnrolment }     from "../modules/enrolment/enrolment.container";
// import { registerAttendance }    from "../modules/attendance/attendance.container";
// import { registerGrades }        from "../modules/grades/grades.container";
// import { registerReportCards }   from "../modules/report-cards/report-cards.container";
import { registerFees }          from "../modules/fees/fees.container";
import { registerPayments }      from "../modules/payments/payments.container";
// import { registerNotifications } from "../modules/notifications/notifications.container";
// import { registerSuperAdmin }    from "../modules/super-admin/super-admin.container";
// import { registerSchoolSettings } from "../modules/school-settings/school-settings.container";
// import { registerPlatformSettings } from "../modules/platform-settings/platform-settings.container";
// import { registerFeedback } from "../modules/feedback/feedback.container";

const modules: Array<(c: AwilixContainer) => void> = [
    registerShared,
    registerFoundation,
    registerAuth,
    registerSchool,
    registerUser,
    registerPlans,
    registerSubscriptions,
    registerBranches,
    registerStaff,
    registerLedger,
    registerStudents,
    registerGuardians,
    // registerClasses,
    // registerSessions,
    // registerEnrolment,
    // registerAttendance,
    // registerGrades,
    // registerReportCards,
    registerFees,
    registerPayments,
    registerAudit,
    // registerNotifications,
    // registerSuperAdmin, 
    // registerSchoolSettings,
    // registerPlatformSettings,
    // registerFeedback
];

/*
|--------------------------------------------------------------------------
| INIT
|--------------------------------------------------------------------------
*/
export const initContainer = (): void => {
    modules.forEach(fn => fn(container));
    console.log("✅ DI container initialized");
};

export const disposeContainer = async (): Promise<void> => {
    await disconnectPrisma();
    await container.dispose();
    console.log("✅ DI container disposed");
};