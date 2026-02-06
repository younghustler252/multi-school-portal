import { renderTemplate } from "../utils/templateRenderer";

export enum NotificationTemplateKey {
    SCHOOL_ACTIVATED = "SCHOOL_ACTIVATED",
    PAYMENT_DUE = "PAYMENT_DUE",
    NEW_ASSIGNMENT = "NEW_ASSIGNMENT"
}

export const NOTIFICATION_TEMPLATES: Record<NotificationTemplateKey, string> = {
    [NotificationTemplateKey.SCHOOL_ACTIVATED]: "Your school \"{{schoolName}}\" has been activated successfully.",
    [NotificationTemplateKey.PAYMENT_DUE]: "Dear {{studentName}}, your tuition for \"{{schoolName}}\" is due on {{dueDate}}.",
    [NotificationTemplateKey.NEW_ASSIGNMENT]: "Hi {{studentName}}, a new assignment \"{{assignmentTitle}}\" has been posted."
};

// Optional helper for convenience
export function renderNotification(templateKey: NotificationTemplateKey, variables: Record<string, string>) {
    const template = NOTIFICATION_TEMPLATES[templateKey];
    if (!template) throw new Error(`Template not found: ${templateKey}`);
    return renderTemplate(template, variables);
}
