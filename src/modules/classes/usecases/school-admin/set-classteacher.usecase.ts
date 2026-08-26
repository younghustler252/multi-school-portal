import { IClassRepository } from "../../repositories/class.repository";
import { IStaffRepository } from "../../../staff/repositories/staff.repository";
import { NotFoundError, BadRequestError } from "../../../../shared/errors/domain.errors";
import { ClassErrorMessage } from "../../domain/class.enums";

interface Dependencies {
    classRepository: IClassRepository;
    staffRepository: IStaffRepository;
}

export class SetClassTeacherUseCase {
    private readonly classRepository: IClassRepository;
    private readonly staffRepository: IStaffRepository;

    constructor({ classRepository, staffRepository }: Dependencies) {
        this.classRepository = classRepository;
        this.staffRepository = staffRepository;
    }

    async execute(classId: string, staffId: string | null) {
        const cls = await this.classRepository.findClassById(classId);
        if (!cls) throw new NotFoundError(ClassErrorMessage.NOT_FOUND);

        if (staffId) {
            const staff = await this.staffRepository.findById(staffId);
            if (!staff) throw new NotFoundError("Staff member not found");
            if (staff.role !== "teacher" && staff.role !== "principal") {
                throw new BadRequestError("Class teacher must be a teacher or principal.");
            }
        }

        return this.classRepository.updateClass(classId, { classTeacherId: staffId });
    }
}