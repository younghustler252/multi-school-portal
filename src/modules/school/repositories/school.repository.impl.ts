import { ISchoolRepository } from "./school.repository";
import { School } from "../domain/school.entity";
import { SchoolModel } from "../models/school.model";
import { SchoolMapper } from "../mappers/school.mapper";

export class SchoolRepository implements ISchoolRepository {
    
    async create(school: School): Promise<School> {
        const data = SchoolMapper.toPersistenceCreate(school);

        const created = await SchoolModel.create(data);

        return SchoolMapper.toDomain(created);
    }

    async findById(id: string): Promise<School | null> {
        const doc = await SchoolModel.findById(id);

        if (!doc) return null;

        return SchoolMapper.toDomain(doc);
    }

    async findBySlug(slug: string): Promise<School | null> {
        const doc = await SchoolModel.findOne({ slug });

        if (!doc) return null;

        return SchoolMapper.toDomain(doc);
    }

    async findByEmail(email: string): Promise<School | null> {
        const doc = await SchoolModel.findOne({ email });

        if (!doc) return null;

        return SchoolMapper.toDomain(doc);
    }

    async update(id: string, school: Partial<School>): Promise<School | null> {
        const existing = await SchoolModel.findById(id);
        if (!existing) return null;

        const domain = SchoolMapper.toDomain(existing);

        // merge updates into domain props safely
        const updatedDomain = new School({
            ...domain.getProps(),
            ...school,
            updatedAt: new Date(),
        });

        const updateData = SchoolMapper.toPersistenceUpdate(updatedDomain);

        const doc = await SchoolModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            {
                returnDocument: "after",
            }
        );

        if (!doc) return null;

        return SchoolMapper.toDomain(doc);
    }

    async delete(id: string): Promise<void> {
        await SchoolModel.findByIdAndUpdate(id, {
            $set: {
                deletedAt: new Date(),
                status: "DELETED",
            },
        });
    }
}