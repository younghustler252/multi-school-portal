import { IEnrolmentRepository }   from "../repositories/enrolment.repository";
import { EnrolmentMapper }        from "../mappers/enrolment.mapper";
import { EnrolmentResponseData }  from "../mappers/enrolment.mapper";
import { NotFoundError }          from "../../../shared/errors/domain.errors";
import { EnrolmentErrorMessage }  from "../domain/enrolment.enums";
import { UpdateEnrolmentDtoType } from "../dtos/enrolment.dto";

/*
|--------------------------------------------------------------------------
| UPDATE ENROLMENT USE CASE
| Change status — withdraw, transfer, complete
|--------------------------------------------------------------------------
*/

interface Dependencies {
    enrolmentRepository: IEnrolmentRepository;
    enrolmentMapper:     EnrolmentMapper;
}

export class UpdateEnrolmentUseCase {
    private readonly enrolmentRepository: IEnrolmentRepository;
    private readonly enrolmentMapper:     EnrolmentMapper;

    constructor({ enrolmentRepository, enrolmentMapper }: Dependencies) {
        this.enrolmentRepository = enrolmentRepository;
        this.enrolmentMapper     = enrolmentMapper;
    }

    async execute(
        id:  string,
        dto: UpdateEnrolmentDtoType,
    ): Promise<EnrolmentResponseData> {

        const enrolment = await this.enrolmentRepository.findById(id);
        if (!enrolment) {
            throw new NotFoundError(EnrolmentErrorMessage.NOT_FOUND);
        }

        const updated = await this.enrolmentRepository.update(id, {
            status: dto.status,
        });

        return this.enrolmentMapper.toResponse(updated);
    }
}