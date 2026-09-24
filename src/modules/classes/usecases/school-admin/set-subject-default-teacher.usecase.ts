import { IClassRepository } from "../../repositories/class.repository";
import { IStaffRepository } from "../../../staff/repositories/staff.repository";
import { NotFoundError } from "../../../../shared/errors/domain.errors";

interface Dependencies {
	classRepository: IClassRepository;
	staffRepository: IStaffRepository;
}

export class SetSubjectDefaultTeacherUseCase {
	private readonly classRepository: IClassRepository;
	private readonly staffRepository: IStaffRepository;

	constructor({
		classRepository,
		staffRepository,
	}: Dependencies) {
		this.classRepository = classRepository;
		this.staffRepository = staffRepository;
	}

	async execute(subjectId: string, staffId: string | null) {
		const subject = await this.classRepository.findSubjectById(subjectId);

		if (!subject) {
			throw new NotFoundError("Subject not found");
		}

		if (staffId) {
			const staff = await this.staffRepository.findById(staffId);

			if (!staff) {
				throw new NotFoundError("Staff member not found");
			}
		}

		return this.classRepository.setSubjectDefaultTeacher(subjectId, staffId);
	}
}
