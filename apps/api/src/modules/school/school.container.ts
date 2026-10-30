import { asClass, asFunction } from "awilix";
import type { AwilixContainer } from "awilix";
import { SchoolMapper, SchoolDocumentMapper } from "./mappers/school.mapper";
import { SchoolRepositoryImpl } from "./repositories/school.repository.impl";
import { SchoolApprovalCheckerService } from "./services/school-approval-checker.service";
import { WorkspaceActivationService } from "./services/workspace-activation.service";

// School realm
import { GetSchoolUseCase } from "./usecases/get-school.usecase";
import { UpdateSchoolUseCase } from "./usecases/update-school.usecase";
import { UploadLogoUseCase } from "./usecases/upload-logo.usecase";
import { UploadDocumentUseCase } from "./usecases/upload-document.usecase";
import { GetDocumentsUseCase } from "./usecases/get-documents.usecase";
import { SetupPaymentUseCase } from "./usecases/setup-payment.usecase";
import { GetDashboardUseCase } from "./usecases/get-dashboard.usecase";
import { GetSetupChecklistUseCase } from "./usecases/get-setup-checklist.usecase";
import { GetPublicSchoolInfoUseCase } from "./usecases/get-public-school-info.usecase";

// Platform realm
import { ListSchoolsUseCase } from "./usecases/platform/list-schools.usecase";
import { GetPlatformSchoolUseCase } from "./usecases/platform/get-school.usecase";
import { CreatePlatformSchoolUseCase } from "./usecases/platform/create-school.usecase";
import { UpdatePlatformSchoolUseCase } from "./usecases/platform/update-school.usecase";
import { VerifySchoolUseCase } from "./usecases/platform/verify-school.usecase";
import { RejectSchoolUseCase } from "./usecases/platform/reject-school.usecase";
import { SuspendSchoolUseCase, ReactivateSchoolUseCase } from "./usecases/platform/suspend-school.usecase";
import { SchoolDocumentsReviewUseCase } from "./usecases/platform/school-documents.usecases";
import { ListSchoolProvisioningUseCase, RetrySchoolProvisioningUseCase, bullProvisionQueue } from "./usecases/platform/school-provisioning.usecases";
import { RunSchoolLifecycleUseCase } from "./usecases/platform/run-school-lifecycle.usecase";

import { SchoolController } from "./controllers/school.controller";
import { SchoolPlatformController } from "./controllers/school-platform.controller";

/*
| Requires: registerAuth (userRepository, urlService, authMessageService, passwordService, loginAttemptService),
| plans, subscriptions, audit, notifications, and from registerShared: prismaClient, storageService,
| encryptionService, paymentProvider, verificationProvider.
*/
export const registerSchool = (container: AwilixContainer): void => {
    container.register({
        schoolMapper:         asClass(SchoolMapper).singleton(),
        schoolDocumentMapper: asClass(SchoolDocumentMapper).singleton(),
        schoolRepository:     asClass(SchoolRepositoryImpl).scoped(),

        schoolApprovalCheckerService: asClass(SchoolApprovalCheckerService).scoped(),
        workspaceActivationService:   asClass(WorkspaceActivationService).scoped(),

        // ── School realm ──
        getSchoolUseCase:          asClass(GetSchoolUseCase).scoped(),
        updateSchoolUseCase:       asClass(UpdateSchoolUseCase).scoped(),
        uploadLogoUseCase:         asClass(UploadLogoUseCase).scoped(),
        uploadDocumentUseCase:     asClass(UploadDocumentUseCase).scoped(),
        getDocumentsUseCase:       asClass(GetDocumentsUseCase).scoped(),
        setupPaymentUseCase:       asClass(SetupPaymentUseCase).scoped(),
        getDashboardUseCase:       asClass(GetDashboardUseCase).scoped(),
        getSetupChecklistUseCase:  asClass(GetSetupChecklistUseCase).scoped(),
        getPublicSchoolInfoUseCase: asClass(GetPublicSchoolInfoUseCase).scoped(),

        // ── Platform realm ──
        listSchoolsUseCase:           asClass(ListSchoolsUseCase).scoped(),
        getPlatformSchoolUseCase:     asClass(GetPlatformSchoolUseCase).scoped(),
        createPlatformSchoolUseCase:  asClass(CreatePlatformSchoolUseCase).scoped(),
        updatePlatformSchoolUseCase:  asClass(UpdatePlatformSchoolUseCase).scoped(),
        verifySchoolUseCase:          asClass(VerifySchoolUseCase).scoped(),
        rejectSchoolUseCase:          asClass(RejectSchoolUseCase).scoped(),
        suspendSchoolUseCase:         asClass(SuspendSchoolUseCase).scoped(),
        reactivateSchoolUseCase:      asClass(ReactivateSchoolUseCase).scoped(),
        schoolDocumentsReviewUseCase: asClass(SchoolDocumentsReviewUseCase).scoped(),
        provisionQueue:               asFunction(() => bullProvisionQueue()).singleton(),
        listSchoolProvisioningUseCase:  asClass(ListSchoolProvisioningUseCase).scoped(),
        retrySchoolProvisioningUseCase: asClass(RetrySchoolProvisioningUseCase).scoped(),
        runSchoolLifecycleUseCase:    asClass(RunSchoolLifecycleUseCase).scoped(),

        schoolController:         asClass(SchoolController).scoped(),
        schoolPlatformController: asClass(SchoolPlatformController).scoped(),
    });
};
