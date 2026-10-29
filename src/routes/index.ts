import { Router } from "express";


import authRouter from "../modules/auth/routes/auth.routes";
import userRouter from "../modules/user/routes/user.routes"
import schoolRouter from "../modules/school/routes/school.routes";
import plansRouter from "../modules/plans/routes/plan.routes";
import subscriptionRouter from "../modules/subscriptions/routes/billing.routes";
import branchRouter from "../modules/branches/routes/branch.routes"
import staffRouter from "../modules/staff/routes/staff.routes";
import studentRouter from "../modules/students/routes/student.routes";
import guardianRouter from "../modules/guardians/routes/guardian.routes";
import classRouter from "../modules/classes/routes/class.routes";
import enrolmentRouter from "../modules/enrolment/routes/enrolment.routes";
// import attendanceRouter from "../modules/attendance/routes/attendance.routes";
// import gradeRouter from "../modules/grades/routes/grade.routes"
// import reportCardRouter from "../modules/report-cards/routes/report-card.routes"
import feesRouter from "../modules/fees/routes/fee-setup.routes";
import feeInvoiceRouter from "../modules/fees/routes/fee-invoice.routes";
import feeReportRouter from "../modules/fees/routes/fee-report.routes";
import feeAdjustmentRouter from "../modules/fees/routes/fee-adjustment.routes";
import financeReportRouter from "../modules/finance-reports/routes/report.routes";
import expenseRouter from "../modules/expenses/routes/expense.routes";
import vendorRouter from "../modules/expenses/routes/vendor.routes";
import budgetRouter from "../modules/expenses/routes/budget.routes";
import recurringExpenseRouter from "../modules/expenses/routes/recurring.routes";
import payrollRouter from "../modules/payroll/routes/payroll.routes";
import myPayslipsRouter from "../modules/payroll/routes/my-payslips.routes";
import sessionRouter from "../modules/sessions/routes/session.routes"
import paymentRouter from "../modules/payments/routes/payment.routes";
// import superAdminRouter from "../modules/super-admin/routes/super-admin.routes";
import auditRouter from "../modules/audit/routes/audit.routes"
import ledgerRouter from "../modules/ledger/routes/ledger.routes";
import financeSettingsRouter from "../modules/finance-settings/routes/finance-settings.routes";
import bankReconciliationRouter from "../modules/bank-reconciliation/routes/bank-reconciliation.routes";
import gatewaySettlementsRouter from "../modules/gateway-settlements/routes/settlement.routes";
import payrollTransfersRouter from "../modules/payroll-transfers/routes/transfer.routes";
// import notificationRouter from "../modules/notifications/routes/notification.routes";
import schoolSettingRouter from "../modules/school-settings/routes/school-settings.routes"
import messageTemplateRouter from "../modules/message-templates/routes/message-template.routes";
// import platformsettingsRouter from "../modules/platform-settings/routes/platform-settings.route"
// import feedbackRouter from "../modules/feedback/routes/feedback.routes"

const router = Router();

// versioned API grouping
router.use("/auth", authRouter);
router.use("/users", userRouter)
router.use("/schools", schoolRouter);
router.use("/plans", plansRouter);
router.use("/subscriptions", subscriptionRouter);
router.use("/audit", auditRouter)   
router.use("/staff", staffRouter);
router.use("/branches", branchRouter);
router.use("/finance/settings", financeSettingsRouter);
router.use("/finance/reconciliation", bankReconciliationRouter);
router.use("/finance/settlements", gatewaySettlementsRouter);
router.use("/finance", ledgerRouter);
router.use("/students", studentRouter);
router.use("/guardians", guardianRouter);
router.use("/classes", classRouter);
router.use("/enrolments", enrolmentRouter);
// router.use("/attendance", attendanceRouter);
// router.use("/grades", gradeRouter)
router.use("/sessions", sessionRouter)
// router.use("/report-cards", reportCardRouter)
router.use("/finance", financeReportRouter);
router.use("/expenses", expenseRouter);
router.use("/vendors", vendorRouter);
router.use("/budgets", budgetRouter);
router.use("/recurring-expenses", recurringExpenseRouter);
router.use("/payroll/transfers", payrollTransfersRouter);
router.use("/payroll", payrollRouter);
router.use("/my/payslips", myPayslipsRouter);
router.use("/fees/invoices", feeInvoiceRouter);
router.use("/fees/adjustments", feeAdjustmentRouter);
router.use("/fees", feeReportRouter);
router.use("/fees", feesRouter);
router.use("/payments", paymentRouter)
// router.use("/super-admin", superAdminRouter)
// router.use("/notifications", notificationRouter);
router.use("/school-settings", schoolSettingRouter)
router.use("/message-templates", messageTemplateRouter);
// router.use("/platform-settings", platformsettingsRouter)
// router.use("/feedback", feedbackRouter)

export default router;