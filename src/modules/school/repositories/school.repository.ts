import { School } from "../domain/school.entity";

export interface ISchoolRepository {
    create(school: School): Promise<School>;
    findById(id: string): Promise<School | null>;
    findBySlug(slug: string): Promise<School | null>;
    findByEmail(email: string): Promise<School | null>;

    update(id: string, school: Partial<School>): Promise<School | null>;
    delete(id: string): Promise<void>;
}