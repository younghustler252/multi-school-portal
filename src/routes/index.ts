import { Router } from "express";


import authRouter from "../modules/auth/routes/auth.routes";
import schoolRouter from "../modules/school/routes/school.routes";
import plansRouter from "../modules/plans/routes/plan.routes";
import subscriptionRouter from "../modules/subscriptions/routes/subscription.routes";
// import studentRouter from "../modules/students/routes";
// import staffRouter from "../modules/staff/routes";
// import feesRouter from "../modules/fees/routes";
// import attendanceRouter from "../modules/attendance/routes";
// import notificationRouter from "../modules/notifications/routes";

const router = Router();

// versioned API grouping
router.use("/auth", authRouter);
router.use("/schools", schoolRouter);
router.use("/plans", plansRouter);
// router.use("/students", studentRouter);
// router.use("/staff", staffRouter);
// router.use("/fees", feesRouter);
// router.use("/attendance", attendanceRouter);
// router.use("/notifications", notificationRouter);
router.use("/subscriptions", subscriptionRouter);
export default router;