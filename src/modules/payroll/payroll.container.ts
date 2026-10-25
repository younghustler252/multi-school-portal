import { asClass } from "awilix";
import type { AwilixContainer } from "awilix";
import { ComponentMapper, ProfileMapper, RunMapper, LoanMapper, RemittanceMapper } from "./mappers/payroll.mapper";
import {
    PayComponentRepositoryImpl, PayProfileRepositoryImpl, PayrollRunRepositoryImpl, LoanRepositoryImpl, RemittanceRepositoryImpl, PayrollContextRepositoryImpl,
} from "./repositories/payroll.repositories.impl";
import { ListComponentsUseCase, GetComponentUseCase, CreateComponentUseCase, UpdateComponentUseCase, SetComponentActiveUseCase, DeleteComponentUseCase } from "./usecases/component.usecases";
import { SetPayProfileUseCase, GetPayProfileUseCase, ListPayProfilesUseCase } from "./usecases/profile.usecases";
import {
    ListRunsUseCase, GetRunUseCase, CreateRunUseCase, CalculateRunUseCase, SubmitRunUseCase, ApproveRunUseCase, RejectRunUseCase, CancelRunUseCase, ReverseRunUseCase, PayRunUseCase,
} from "./usecases/run.usecases";
import { ListPayslipsUseCase, GetPayslipUseCase, PayslipDocumentUseCase } from "./usecases/payslip.usecases";
import { ListLoansUseCase, GetLoanUseCase, CreateLoanUseCase, CancelLoanUseCase } from "./usecases/loan.usecases";
import { ListRemittancesUseCase, CreateRemittanceUseCase, ReverseRemittanceUseCase, RemittancesDueUseCase } from "./usecases/remittance.usecases";
import { PayrollSummaryUseCase } from "./usecases/payroll-summary.usecase";
import { PayrollController } from "./controllers/payroll.controller";

/*
| Requires: the ledger module (postingService, ledgerAccountRepository, ledgerReportRepository), the payments module's paymentContextRepository (school header),
| the shared numberSequenceService and encryptionService, and the audit module.
*/
export const registerPayroll = (container: AwilixContainer): void => {
    container.register({
        componentMapper:  asClass(ComponentMapper).singleton(),
        profileMapper:    asClass(ProfileMapper).singleton(),
        runMapper:        asClass(RunMapper).singleton(),
        loanMapper:       asClass(LoanMapper).singleton(),
        remittanceMapper: asClass(RemittanceMapper).singleton(),

        payComponentRepository:   asClass(PayComponentRepositoryImpl).scoped(),
        payProfileRepository:     asClass(PayProfileRepositoryImpl).scoped(),
        payrollRunRepository:     asClass(PayrollRunRepositoryImpl).scoped(),
        loanRepository:           asClass(LoanRepositoryImpl).scoped(),
        remittanceRepository:     asClass(RemittanceRepositoryImpl).scoped(),
        payrollContextRepository: asClass(PayrollContextRepositoryImpl).scoped(),

        listComponentsUseCase: asClass(ListComponentsUseCase).scoped(), getComponentUseCase: asClass(GetComponentUseCase).scoped(),
        createComponentUseCase: asClass(CreateComponentUseCase).scoped(), updateComponentUseCase: asClass(UpdateComponentUseCase).scoped(),
        setComponentActiveUseCase: asClass(SetComponentActiveUseCase).scoped(), deleteComponentUseCase: asClass(DeleteComponentUseCase).scoped(),

        setPayProfileUseCase: asClass(SetPayProfileUseCase).scoped(), getPayProfileUseCase: asClass(GetPayProfileUseCase).scoped(), listPayProfilesUseCase: asClass(ListPayProfilesUseCase).scoped(),

        listRunsUseCase: asClass(ListRunsUseCase).scoped(), getRunUseCase: asClass(GetRunUseCase).scoped(), createRunUseCase: asClass(CreateRunUseCase).scoped(),
        calculateRunUseCase: asClass(CalculateRunUseCase).scoped(), submitRunUseCase: asClass(SubmitRunUseCase).scoped(), approveRunUseCase: asClass(ApproveRunUseCase).scoped(),
        rejectRunUseCase: asClass(RejectRunUseCase).scoped(), cancelRunUseCase: asClass(CancelRunUseCase).scoped(), reverseRunUseCase: asClass(ReverseRunUseCase).scoped(),
        payRunUseCase: asClass(PayRunUseCase).scoped(),

        listPayslipsUseCase: asClass(ListPayslipsUseCase).scoped(), getPayslipUseCase: asClass(GetPayslipUseCase).scoped(), payslipDocumentUseCase: asClass(PayslipDocumentUseCase).scoped(),

        listLoansUseCase: asClass(ListLoansUseCase).scoped(), getLoanUseCase: asClass(GetLoanUseCase).scoped(),
        createLoanUseCase: asClass(CreateLoanUseCase).scoped(), cancelLoanUseCase: asClass(CancelLoanUseCase).scoped(),

        listRemittancesUseCase: asClass(ListRemittancesUseCase).scoped(), createRemittanceUseCase: asClass(CreateRemittanceUseCase).scoped(),
        reverseRemittanceUseCase: asClass(ReverseRemittanceUseCase).scoped(), remittancesDueUseCase: asClass(RemittancesDueUseCase).scoped(),

        payrollSummaryUseCase: asClass(PayrollSummaryUseCase).scoped(),
        payrollController:     asClass(PayrollController).scoped(),
    });
};
