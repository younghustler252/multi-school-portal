    import { Router }              from "express";
    import { container }           from "../../../container";
    import { SessionController }   from "../controllers/session.controller";
    import { validate }            from "../../../infrastructure/middleware/validate.middleware";
    import { authenticate }        from "../../../infrastructure/middleware/auth.middleware";
    import {
        requireSchoolAdmin,
        requireStaff,
    }                              from "../../../infrastructure/middleware/rbac.middleware";
    import { requireTenant }       from "../../../infrastructure/middleware/tenant-resolver.middleware";
    import {
        CreateSessionDto,
        UpdateSessionDto,
        CreateTermDto,
        UpdateTermDto,
    }                              from "../dtos/session.dto";

    const router = Router();
    const ctrl   = () => container.resolve<SessionController>("sessionController");

    // ── Get all sessions ──────────────────────────────────────────────────────
    router.get(
        "/",
        authenticate,
        requireTenant,
        requireStaff,
        (req, res, next) => ctrl().getSessions(req, res, next),
    );

    // ── Get current session + active term ─────────────────────────────────────
    router.get(
        "/current",
        authenticate,
        requireTenant,
        // requireStaff,
        (req, res, next) => ctrl().getCurrentSession(req, res, next),
    );

    // ── Create new session ────────────────────────────────────────────────────
    router.post(
        "/",
        authenticate,
        requireTenant,
        requireSchoolAdmin,
        validate(CreateSessionDto),
        (req, res, next) => ctrl().createSession(req, res, next),
    );

    // ── Set current session ───────────────────────────────────────────────────
    router.put(
        "/:id/set-current",
        authenticate,
        requireTenant,
        requireSchoolAdmin,
        (req, res, next) => ctrl().setCurrentSession(req, res, next),
    );

    // ── Create term inside session ────────────────────────────────────────────
    router.post(
        "/terms",
        authenticate,
        requireTenant,
        requireSchoolAdmin,
        validate(CreateTermDto),
        (req, res, next) => ctrl().createTerm(req, res, next),
    );

    // ── Update term dates ─────────────────────────────────────────────────────
    router.put(
        "/terms/:termId",
        authenticate,
        requireTenant,
        requireSchoolAdmin,
        validate(UpdateTermDto),
        (req, res, next) => ctrl().updateTerm(req, res, next),
    );

    // ── Set current term ──────────────────────────────────────────────────────
    router.put(
        "/terms/:termId/set-current",
        authenticate,
        requireTenant,
        requireSchoolAdmin,
        (req, res, next) => ctrl().setCurrentTerm(req, res, next),
    );

    export default router;