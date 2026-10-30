import { Router } from "express";
import { container } from "../../../container";
import { MessageTemplateController } from "../controllers/message-template.controller";
import { validate } from "../../../infrastructure/middleware/validate.middleware";
import { authenticate } from "../../../infrastructure/middleware/auth.middleware";
import { requireTenant } from "../../../infrastructure/middleware/tenant-resolver.middleware";
import { requirePermission } from "../../../infrastructure/middleware/rbac.middleware";
import { SaveTemplateDto, PreviewTemplateDto } from "../dtos/message-template.dto";

/*
| MESSAGE TEMPLATE ROUTES (school realm, mounted at /message-templates). :channel is in_app, email or sms.
|   GET    /                          message_templates.view     every message with its placeholders and the text for each channel
|   GET    /:key                      message_templates.view     one message (for example fee.reminder)
|   PUT    /:key/:channel             message_templates.manage   save the school's own words (email and SMS need the plan feature)
|   DELETE /:key/:channel             message_templates.manage   go back to the platform default
|   POST   /:key/:channel/preview     message_templates.manage   render a draft with sample data (nothing is saved or sent)
*/
const router = Router();
const ctrl = () => container.resolve<MessageTemplateController>("messageTemplateController");
const guard = (permission: string) => [authenticate, requireTenant, requirePermission(permission)] as const;

router.get("/", ...guard("message_templates.view"), (q, s, n) => ctrl().list(q, s, n));
router.get("/:key", ...guard("message_templates.view"), (q, s, n) => ctrl().get(q, s, n));
router.put("/:key/:channel", ...guard("message_templates.manage"), validate(SaveTemplateDto), (q, s, n) => ctrl().save(q, s, n));
router.delete("/:key/:channel", ...guard("message_templates.manage"), (q, s, n) => ctrl().reset(q, s, n));
router.post("/:key/:channel/preview", ...guard("message_templates.manage"), validate(PreviewTemplateDto), (q, s, n) => ctrl().preview(q, s, n));

export default router;
