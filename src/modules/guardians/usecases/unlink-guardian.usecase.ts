import { IGuardianRepository }  from "../repositories/guardian.repository";
import { NotFoundError }        from "../../../shared/errors/domain.errors";
import { GuardianErrorMessage } from "../domain/guardian.enums";

interface Dependencies {
    guardianRepository: IGuardianRepository;
}

export class UnlinkGuardianUseCase {
    private readonly guardianRepository: IGuardianRepository;

    constructor({ guardianRepository }: Dependencies) {
        this.guardianRepository = guardianRepository;
    }

    async execute(guardianId: string, studentId: string): Promise<{ message: string }> {
        const isLinked = await this.guardianRepository.isLinked(guardianId, studentId);

        if (!isLinked) {
            throw new NotFoundError(GuardianErrorMessage.NOT_LINKED ?? "Guardian is not linked to this student.");
        }

        await this.guardianRepository.unlinkFromStudent(guardianId, studentId);

        return { message: "Guardian unlinked from student." };
    }
}