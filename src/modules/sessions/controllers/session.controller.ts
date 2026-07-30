import { Request, Response, NextFunction } from "express";
import { GetSessionsUseCase }        from "../usecases/get-sessions.usecase";
import { GetCurrentSessionUseCase }  from "../usecases/get-current-session.usecase";
import { CreateSessionUseCase }      from "../usecases/create-session.usecase";
import { SetCurrentSessionUseCase }  from "../usecases/set-current-session.usecase";
import { CreateTermUseCase }         from "../usecases/create-term.usecase";
import { UpdateTermUseCase }         from "../usecases/update-term.usecase";
import { SetCurrentTermUseCase }     from "../usecases/set-current-term.usecase";

import { CreateCalendarEventUseCase } from "../usecases/create-calendar-event.usecase";
import { GetCalendarEventsUseCase }   from "../usecases/get-calendar-events.usecase";
import {
    sendSuccess,
    sendCreated,
}                                    from "../../../shared/utils/api-response";

interface Dependencies {
    getSessionsUseCase:       GetSessionsUseCase;
    getCurrentSessionUseCase: GetCurrentSessionUseCase;
    createSessionUseCase:     CreateSessionUseCase;
    setCurrentSessionUseCase: SetCurrentSessionUseCase;
    createTermUseCase:        CreateTermUseCase;
    updateTermUseCase:        UpdateTermUseCase;
    setCurrentTermUseCase:    SetCurrentTermUseCase;
    
    getCalendarEventsUseCase: GetCalendarEventsUseCase;
    createCalendarEventUseCase: CreateCalendarEventUseCase;
}

export class SessionController {
    private readonly getSessionsUseCase:       GetSessionsUseCase;
    private readonly getCurrentSessionUseCase: GetCurrentSessionUseCase;
    private readonly createSessionUseCase:     CreateSessionUseCase;
    private readonly setCurrentSessionUseCase: SetCurrentSessionUseCase;
    private readonly createTermUseCase:        CreateTermUseCase;
    private readonly updateTermUseCase:        UpdateTermUseCase;
    private readonly setCurrentTermUseCase:    SetCurrentTermUseCase;

    private readonly getCalendarEventsUseCase: GetCalendarEventsUseCase;
    private readonly createCalendarEventUseCase: CreateCalendarEventUseCase;

    constructor({
        getSessionsUseCase,
        getCurrentSessionUseCase,
        createSessionUseCase,
        setCurrentSessionUseCase,
        createTermUseCase,
        updateTermUseCase,
        setCurrentTermUseCase,
        getCalendarEventsUseCase,
        createCalendarEventUseCase,
    }: Dependencies) {
        this.getSessionsUseCase       = getSessionsUseCase;
        this.getCurrentSessionUseCase = getCurrentSessionUseCase;
        this.createSessionUseCase     = createSessionUseCase;
        this.setCurrentSessionUseCase = setCurrentSessionUseCase;
        this.createTermUseCase        = createTermUseCase;
        this.updateTermUseCase        = updateTermUseCase;
        this.setCurrentTermUseCase    = setCurrentTermUseCase;

        this.getCalendarEventsUseCase = getCalendarEventsUseCase;
        this.createCalendarEventUseCase = createCalendarEventUseCase;
    }

    // ── Get all sessions ──────────────────────────────────────────────────
    getSessions = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getSessionsUseCase.execute();
            sendSuccess(res, result, "Sessions retrieved successfully");
        } catch (err) { next(err); }
    };

    // ── Get current session + term ────────────────────────────────────────
    getCurrentSession = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getCurrentSessionUseCase.execute();
            sendSuccess(res, result, "Current session retrieved successfully");
        } catch (err) { next(err); }
    };

    // ── Create session ────────────────────────────────────────────────────
    createSession = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createSessionUseCase.execute(req.body);
            sendCreated(res, result, "Session created successfully");
        } catch (err) { next(err); }
    };

    // ── Set current session ───────────────────────────────────────────────
    setCurrentSession = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.setCurrentSessionUseCase.execute(
                req.params.id as string,
            );
            sendSuccess(res, result, "Current session updated successfully");
        } catch (err) { next(err); }
    };

    // ── Create term ───────────────────────────────────────────────────────
    createTerm = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createTermUseCase.execute(req.body);
            sendCreated(res, result, "Term created successfully");
        } catch (err) { next(err); }
    };

    // ── Update term ───────────────────────────────────────────────────────
    updateTerm = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.updateTermUseCase.execute(
                req.params.termId as string,
                req.body,
            );
            sendSuccess(res, result, "Term updated successfully");
        } catch (err) { next(err); }
    };

    // ── Set current term ──────────────────────────────────────────────────
    setCurrentTerm = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.setCurrentTermUseCase.execute(
                req.params.termId as string,
            );
            sendSuccess(res, result, "Current term updated successfully");
        } catch (err) { next(err); }
    };


    getCalendarEvents = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.getCalendarEventsUseCase.execute(
                req.query as any,
            );
            sendSuccess(res, result, "Calendar events retrieved successfully");
        } catch (err) { next(err); }
    };
    
    createCalendarEvent = async (
        req: Request, res: Response, next: NextFunction,
    ): Promise<void> => {
        try {
            const result = await this.createCalendarEventUseCase.execute(
                req.body,
                req.user!.id,
            );
            sendCreated(res, result, "Calendar event created successfully");
        } catch (err) { next(err); }
    };


}


