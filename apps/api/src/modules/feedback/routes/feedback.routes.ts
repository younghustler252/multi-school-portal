import { Router }              from "express";
import { container }           from "../../../container";
import { FeedbackController }  from "../controllers/feedback.controller";
import { validate }            from "../../../infrastructure/middleware/validate.middleware";
import { authenticate }        from "../../../infrastructure/middleware/auth.middleware";
import { requirePermission }  from "../../../infrastructure/middleware/rbac.middleware";
import {
    SubmitFeedbackDto,
    ListFeedbackDto,
    UpdateFeedbackStatusDto,
    RespondToFeedbackDto,
}                              from "../dtos/feedback.dto";


const router = Router();

const ctrl = () =>
    container.resolve<FeedbackController>("feedbackController");


// ── Feedback ──────────────────────────────────────────────────────────────

// Submit feedback
router.post(
    "/",
    authenticate,
    validate(SubmitFeedbackDto),
    (req, res, next) => ctrl().submitFeedback(req, res, next),
);

// Get my feedback
router.get(
    "/my",
    authenticate,
    (req, res, next) => ctrl().getMyFeedback(req, res, next),
);

// List all feedback
router.get(
    "/",
    authenticate,
    requirePermission("platform.feedback.manage"),
    validate(ListFeedbackDto, "query"),
    (req, res, next) => ctrl().listFeedback(req, res, next),
);

// Get feedback by ID
router.get(
    "/:id",
    authenticate,
    requirePermission("platform.feedback.manage"),
    (req, res, next) => ctrl().getFeedback(req, res, next),
);

// Update feedback status
router.patch(
    "/:id/status",
    authenticate,
    requirePermission("platform.feedback.manage"),
    validate(UpdateFeedbackStatusDto),
    (req, res, next) => ctrl().updateFeedbackStatus(req, res, next),
);

// Respond to feedback
router.patch(
    "/:id/respond",
    authenticate,
    requirePermission("platform.feedback.manage"),
    validate(RespondToFeedbackDto),
    (req, res, next) => ctrl().respondToFeedback(req, res, next),
);

// Delete feedback
router.delete(
    "/:id",
    authenticate,
    requirePermission("platform.feedback.manage"),
    (req, res, next) => ctrl().deleteFeedback(req, res, next),
);


export default router;
