import { Router } from "express";


import authRouter from "../modules/auth/routes/auth.routes";
import userRouter from "../modules/user/routes/user.routes"
import schoolRouter from "../modules/school/routes/school.routes";
import plansRouter from "../modules/plans/routes/plan.routes";
import subscriptionRouter from "../modules/subscriptions/routes/subscription.routes";
import staffRouter from "../modules/staff/routes/staff.routes";
import studentRouter from "../modules/students/routes/student.routes";
import guardianRouter from "../modules/guardians/routes/guardian.routes";
import classRouter from "../modules/classes/routes/class.routes";
import enrolmentRouter from "../modules/enrolment/routes/enrolment.routes";
import attendanceRouter from "../modules/attendance/routes/attendance.routes";
import gradeRouter from "../modules/grades/routes/grade.routes"
import reportCardRouter from "../modules/report-cards/routes/report-card.routes"
import feesRouter from "../modules/fees/routes/fee.routes";
import sessionRouter from "../modules/sessions/routes/session.routes"
import paymentRouter from "../modules/payments/routes/payment.routes";
import superAdminRouter from "../modules/super-admin/routes/super-admin.routes";
import auditRouter from "../modules/audit/routes/audit.routes"
import notificationRouter from "../modules/notifications/routes/notification.routes";

const router = Router();

// versioned API grouping
router.use("/auth", authRouter);
router.use("/users", userRouter)
router.use("/schools", schoolRouter);
router.use("/plans", plansRouter);
router.use("/subscriptions", subscriptionRouter);
router.use("/staff", staffRouter);
router.use("/students", studentRouter);
router.use("/guardians", guardianRouter);
router.use("/classes", classRouter);
router.use("/enrolments", enrolmentRouter);
router.use("/attendance", attendanceRouter);
router.use("/grades", gradeRouter)
router.use("/sessions", sessionRouter)
router.use("/report-cards", reportCardRouter)
router.use("/fees", feesRouter);
router.use("/payments", paymentRouter)
router.use("/super-admin,", superAdminRouter)
router.use("/audit", auditRouter)
router.use("/notifications", notificationRouter);
export default router;