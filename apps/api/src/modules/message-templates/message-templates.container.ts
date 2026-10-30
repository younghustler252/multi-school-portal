import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { MessageTemplateRepositoryImpl } from "./repositories/message-template.repository.impl";
import { MessageTemplateService } from "./services/message-template.service";
import {
    ListMessageTemplatesUseCase, GetMessageTemplateUseCase, SaveMessageTemplateUseCase,
    ResetMessageTemplateUseCase, PreviewMessageTemplateUseCase,
} from "./usecases/message-template.usecases";
import { MessageTemplateController } from "./controllers/message-template.controller";

/* Requires: the audit module (auditService) and the foundation (entitlementsService).
   `messageTemplateService` is what the automation engine asks to render a message in the school's own words. */
export const registerMessageTemplates = (container: AwilixContainer): void => {
    container.register({
        messageTemplateRepository: asClass(MessageTemplateRepositoryImpl).scoped(),
        messageTemplateService:    asClass(MessageTemplateService).scoped(),

        listMessageTemplatesUseCase:   asClass(ListMessageTemplatesUseCase).scoped(),
        getMessageTemplateUseCase:     asClass(GetMessageTemplateUseCase).scoped(),
        saveMessageTemplateUseCase:    asClass(SaveMessageTemplateUseCase).scoped(),
        resetMessageTemplateUseCase:   asClass(ResetMessageTemplateUseCase).scoped(),
        previewMessageTemplateUseCase: asClass(PreviewMessageTemplateUseCase).scoped(),

        messageTemplateController: asClass(MessageTemplateController).scoped(),
    });
};
