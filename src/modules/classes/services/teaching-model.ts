import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";

/*
| TEACHING MODEL ("homeroom" or "subject_specialist"). Read straight from the school's settings row, so Classes no
| longer needs the school-settings module to be switched on. When the settings service exists (setting
| `academic.teaching_model`) this is the one place to change.
*/
export class TeachingModelReader {
    async get(): Promise<string | null> {
        const row = await getTenantClient().schoolSettings.findFirst({ select: { teachingModel: true } });
        return row?.teachingModel ?? null;
    }
}
