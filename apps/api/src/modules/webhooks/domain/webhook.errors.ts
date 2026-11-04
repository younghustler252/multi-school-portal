import { AppError, NotFoundError } from "../../../shared/errors/domain.errors";

/* The only place the webhooks module builds domain errors. */
export const webhookErrors = {
    unknownProvider: (name: string) => new AppError(`Unknown webhook provider "${name}"`, 404, true, "WEBHOOK_PROVIDER_UNKNOWN"),
    badSignature:    () => new AppError("Invalid webhook signature", 401, true, "WEBHOOK_SIGNATURE_INVALID"),
    badBody:         () => new AppError("The webhook body must be raw JSON", 400, true, "WEBHOOK_BODY_INVALID"),
    notFound:        () => new NotFoundError("Webhook event"),
    notRetryable:    (status: string) => new AppError(`Only a failed event can be retried (this one is ${status})`, 409, true, "WEBHOOK_NOT_RETRYABLE", { status }),
    noPayload:       () => new AppError("This event was logged before payloads were kept, so it cannot be retried. Use the payments reconciliation instead", 409, true, "WEBHOOK_NO_PAYLOAD"),
    claimed:         () => new AppError("This event is already being retried", 409, true, "WEBHOOK_ALREADY_RETRYING"),
};
