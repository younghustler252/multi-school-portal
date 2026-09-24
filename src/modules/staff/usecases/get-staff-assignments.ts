import { IStaffRepository } from "../repositories/staff.repository";
import { IClassRepository } from "../../classes/repositories/class.repository";
import { ISessionRepository } from "../../sessions/repositories/session.repository";
import {
    NotFoundError,
    BadRequestError,
} from "../../../shared/errors/domain.errors";
import { StaffErrorMessage } from "../domain/staff.enums";

interface Dependencies {
    staffRepository: IStaffRepository;
    classRepository: IClassRepository;
    sessionRepository: ISessionRepository;
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
    private readonly sessionRepository: ISessionRepository;

    constructor({
        staffRepository,
        classRepository,
        sessionRepository,
    }: Dependencies) {
        this.staffRepository = staffRepository;
        this.classRepository = classRepository;
        this.sessionRepository = sessionRepository;
    }

    async execute(
        staffId: string,
    ): Promise<StaffAssignmentResponseData[]> {
        const staff = await this.staffRepository.findById(staffId);

        if (!staff) {
            throw new NotFoundError(StaffErrorMessage.NOT_FOUND);
        }

        const currentTerm = await this.sessionRepository.findCurrentTerm();

        if (!currentTerm) {
            throw new BadRequestError("No current term set.");
        }

        return this.classRepository.findStaffAssignments(
            staffId,
            currentTerm.id,
        );
    }
}
