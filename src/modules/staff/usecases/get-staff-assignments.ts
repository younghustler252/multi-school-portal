    import { IStaffRepository } from "../repositories/staff.repository";
    import { IClassRepository } from "../../classes/repositories/class.repository";
    import { NotFoundError }    from "../../../shared/errors/domain.errors";
    import { StaffErrorMessage } from "../domain/staff.enums";

    interface Dependencies {
        staffRepository: IStaffRepository;
        classRepository: IClassRepository;
    }

    export interface StaffAssignmentResponseData {
        classSubjectId: string;
        classId:        string;
        className:      string;
        subjectId:      string;
        subjectName:    string;
        subjectCode:    string | null;
    }

    export class GetStaffAssignmentsUseCase {
        private readonly staffRepository: IStaffRepository;
        private readonly classRepository: IClassRepository;

        constructor({ staffRepository, classRepository }: Dependencies) {
            this.staffRepository = staffRepository;
            this.classRepository = classRepository;
        }

        async execute(staffId: string): Promise<StaffAssignmentResponseData[]> {
            const staff = await this.staffRepository.findById(staffId);

            if (!staff) {
                throw new NotFoundError(StaffErrorMessage.NOT_FOUND);
            }

            return this.classRepository.findStaffAssignments(staffId);
        }
    }