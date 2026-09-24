import { IClassRepository }              from "../../repositories/class.repository";
import { ISessionRepository }            from "../../../sessions/repositories/session.repository";
import { ClassSubjectResolutionService } from "../../services/class-subject-resolution-service";
import { BadRequestError }               from "../../../../shared/errors/domain.errors";

interface Dependencies {
    classRepository:              IClassRepository;
    sessionRepository:            ISessionRepository;
    classSubjectResolutionService: ClassSubjectResolutionService;
}

export class ApplyDefaultsUseCase {
    private readonly classRepository:               IClassRepository;
    private readonly sessionRepository:              ISessionRepository;
    private readonly classSubjectResolutionService:  ClassSubjectResolutionService;

    constructor({ classRepository, sessionRepository, classSubjectResolutionService }: Dependencies) {
        this.classRepository               = classRepository;
        this.sessionRepository             = sessionRepository;
        this.classSubjectResolutionService = classSubjectResolutionService;
    }

    async execute() {
        const currentTerm = await this.sessionRepository.findCurrentTerm();
        if (!currentTerm) throw new BadRequestError("No current term set.");

        const classes = await this.classRepository.findAllClasses();
        let applied = 0;

        for (const cls of classes) {
            const subjects = await this.classRepository.findAllSubjects();

            for (const subject of subjects) {
                const existing = await this.classRepository.findClassSubject(cls.id, subject.id, currentTerm.id);
                if (existing && existing.assignedVia === "manual") continue; // never touch manual
                if (existing) continue; // already auto-resolved, cascades already handle updates to these

                const resolved = await this.classSubjectResolutionService.resolve(cls.id, subject.id);
                if (resolved) {
                    await this.classRepository.assignSubject({
                        classId: cls.id, subjectId: subject.id, staffId: resolved.staffId,
                        termId: currentTerm.id, assignedVia: resolved.assignedVia,
                    });
                    applied++;
                }
            }
        }

        return { message: `${applied} assignment(s) applied.` };
    }
}