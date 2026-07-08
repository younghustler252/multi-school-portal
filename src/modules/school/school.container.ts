import { asClass }                     from "awilix";
import type { AwilixContainer }        from "awilix";

// ── Mappers ───────────────────────────────────────────────────────────────
import { SchoolMapper }                from "./mappers/school.mapper";
import { SchoolDocumentMapper }        from "./mappers/school.mapper";

// ── Repository ────────────────────────────────────────────────────────────
import { SchoolRepositoryImpl }        from "./repositories/school.repository.impl";

// ── School Admin Use Cases ────────────────────────────────────────────────
import { GetSchoolUseCase }            from "./usecases/school-admin/get-school.usecase";
import { UpdateSchoolUseCase }         from "./usecases/school-admin/update-school.usecase";
import { UploadLogoUseCase }           from "./usecases/school-admin/upload-logo.usecase";
import { UploadDocumentUseCase }       from "./usecases/school-admin/upload-document.usecase";
import { GetDocumentsUseCase }         from "./usecases/school-admin/get-documents.usecase";
import { SetupPaymentUseCase }         from "./usecases/school-admin/setup-payment.usecase";

// ── Super Admin Use Cases ─────────────────────────────────────────────────
import { GetAllSchoolsUseCase }        from "./usecases/super-admin/get-all-schools.usecase";
import { GetSchoolByIdUseCase }        from "./usecases/super-admin/get-school-by-id.usecase";
import { CreateSchoolUseCase }         from "./usecases/super-admin/create-school.usecase";
import { VerifySchoolUseCase }         from "./usecases/super-admin/verify-school.usecase";
import { RejectSchoolUseCase }         from "./usecases/super-admin/reject-school.usecase";
import { SuspendSchoolUseCase }        from "./usecases/super-admin/suspend-school.usecase";
import { ActivateSchoolUseCase }       from "./usecases/super-admin/activate-school.usecase";
import { ApproveDocumentUseCase }      from "./usecases/super-admin/approve-document.usecase";
import { RejectDocumentUseCase }       from "./usecases/super-admin/reject-document.usecase";

// ── Controller ────────────────────────────────────────────────────────────
import { SchoolController }            from "./controllers/school.controller";

/*
|--------------------------------------------------------------------------
| SCHOOL CONTAINER
| Registers all school module dependencies into Awilix
|--------------------------------------------------------------------------
*/

export const registerSchool = (container: AwilixContainer): void => {
    container.register({

        // ── Mappers ───────────────────────────────────────────────────────
        schoolMapper:                  asClass(SchoolMapper).singleton(),
        schoolDocumentMapper:          asClass(SchoolDocumentMapper).singleton(),

        // ── Repository ────────────────────────────────────────────────────
        schoolRepository:              asClass(SchoolRepositoryImpl).scoped(),

        // ── School Admin Use Cases ────────────────────────────────────────
        getSchoolUseCase:              asClass(GetSchoolUseCase).scoped(),
        updateSchoolUseCase:           asClass(UpdateSchoolUseCase).scoped(),
        uploadLogoUseCase:             asClass(UploadLogoUseCase).scoped(),
        uploadDocumentUseCase:         asClass(UploadDocumentUseCase).scoped(),
        getDocumentsUseCase:           asClass(GetDocumentsUseCase).scoped(),
        setupPaymentUseCase:           asClass(SetupPaymentUseCase).scoped(),

        // ── Super Admin Use Cases ─────────────────────────────────────────
        getAllSchoolsUseCase:           asClass(GetAllSchoolsUseCase).scoped(),
        getSchoolByIdUseCase:          asClass(GetSchoolByIdUseCase).scoped(),
        createSchoolUseCase:           asClass(CreateSchoolUseCase).scoped(),
        verifySchoolUseCase:           asClass(VerifySchoolUseCase).scoped(),
        rejectSchoolUseCase:           asClass(RejectSchoolUseCase).scoped(),
        suspendSchoolUseCase:          asClass(SuspendSchoolUseCase).scoped(),
        activateSchoolUseCase:         asClass(ActivateSchoolUseCase).scoped(),
        approveDocumentUseCase:        asClass(ApproveDocumentUseCase).scoped(),
        rejectDocumentUseCase:         asClass(RejectDocumentUseCase).scoped(),

        // ── Controller ────────────────────────────────────────────────────
        schoolController:              asClass(SchoolController).scoped(),
    });
};