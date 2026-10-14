import { MembershipService } from "../../auth/services/membership.service";
import { UserActionContext } from "../domain/user.types";

interface Dependencies {
    membershipService: MembershipService;
}

/*
| LIST MY ACCESS — what this login can enter:
|  - personas: the profiles held in the CURRENT school (powers a profile switcher; school sessions only)
|  - schools:  every school this login belongs to (powers a school switcher; links to each school's own address)
*/
export class ListMyAccessUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(ctx: UserActionContext) {
        const schools = await this.d.membershipService.listUserSchools(ctx.userId);

        let personas: { persona: string; current: boolean }[] = [];
        if (ctx.schoolId) {
            const memberships = await this.d.membershipService.listActive(ctx.userId);
            personas = memberships.map(m => ({ persona: m.persona, current: m.id === ctx.membershipId }));
        }
        return { personas, schools: schools.map(s => ({ ...s, current: s.id === ctx.schoolId })) };
    }
}
