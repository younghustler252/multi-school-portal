/*
| How the API layer tells the rest of the app that the session changed, without importing the store (no import cycle).
| The auth store registers its handlers once; the API client calls them.
*/

export type SessionEndReason = "expired" | "invalid" | "tenant-mismatch" | "logout";

type Handlers = {
	onSessionEnded?: (reason: SessionEndReason) => void;
	onMustChangePassword?: () => void;
};

const handlers: Handlers = {};

export function registerSessionHandlers(next: Handlers): void {
	Object.assign(handlers, next);
}

export function emitSessionEnded(reason: SessionEndReason): void {
	handlers.onSessionEnded?.(reason);
}

export function emitMustChangePassword(): void {
	handlers.onMustChangePassword?.();
}
