export interface WebhookAuditLike { log(entry: { userId?: string; action: string; entity: string; entityId?: string | null; module?: string; newValue?: unknown }): Promise<void> }
